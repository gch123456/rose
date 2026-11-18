package com.rose.album;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:album;DB_CLOSE_DELAY=-1", "spring.sql.init.mode=always"})
@Import(AlbumApiTest.GatewayConfiguration.class)
class AlbumApiTest {
    @TestConfiguration
    static class GatewayConfiguration {
        @Bean @Primary WeChatGateway testWeChatGateway() {
            return code -> switch(code) {
                case "alice-code" -> "wx-alice";
                case "bob-code" -> "wx-bob";
                case "offline" -> throw new ApiFailure(503,"wechat_unavailable");
                default -> throw new ApiFailure(401,"wechat_login_failed");
            };
        }
    }
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    MockMvc api;
    @BeforeEach void prepare() {
        api=MockMvcBuilders.webAppContextSetup(context).build();
        jdbc.update("delete from album_entries"); jdbc.update("delete from sessions"); jdbc.update("delete from album_users");
    }
    String login(String code) throws Exception {
        var result=api.perform(post("/api/auth/wechat").contentType("application/json").content("{\"code\":\""+code+"\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.user.id").isString())
            .andExpect(jsonPath("$.expiresAt").isString()).andExpect(jsonPath("$.session_key").doesNotExist()).andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(),"$.token");
    }
    String album(String token) throws Exception {
        return api.perform(get("/api/album").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }
    @Test void loginCreatesOpaqueExpiringSessionWithoutPersistingBearer() throws Exception {
        String token=login("alice-code");
        assertThat(token).matches("[A-Za-z0-9_-]{43}");
        assertThat(jdbc.queryForObject("select token_hash from sessions",String.class)).hasSize(64).isNotEqualTo(token);
        assertThat(album(token)).contains("\"version\":1","\"entries\":[]");
        String again=login("alice-code"); assertThat(again).isNotEqualTo(token);
        assertThat(jdbc.queryForObject("select count(*) from album_users",Integer.class)).isEqualTo(1);
    }
    @Test void allProtectedRoutesRejectMissingOrUnknownSession() throws Exception {
        api.perform(get("/api/album")).andExpect(status().isUnauthorized());
        api.perform(post("/api/album/complete").contentType("application/json").content("{\"levelId\":1}")).andExpect(status().isUnauthorized());
        api.perform(post("/api/album/merge").contentType("application/json").content("{\"levelIds\":[1]}")).andExpect(status().isUnauthorized());
        api.perform(post("/api/auth/logout")).andExpect(status().isUnauthorized());
        api.perform(get("/api/album").header("Authorization","Bearer invented")).andExpect(status().isUnauthorized());
    }
    @Test void completionIsIdempotentAndMergePreservesFirstTimestampAndUserIsolation() throws Exception {
        String alice=login("alice-code"),bob=login("bob-code");
        api.perform(post("/api/album/complete").header("Authorization","Bearer "+alice).contentType("application/json").content("{\"levelId\":1,\"userId\":\"bob\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.entries[0].levelId").value(1));
        String before=album(alice);
        api.perform(post("/api/album/complete").header("Authorization","Bearer "+alice).contentType("application/json").content("{\"levelId\":1}"))
            .andExpect(status().isOk()).andExpect(content().json(before));
        api.perform(post("/api/album/merge").header("Authorization","Bearer "+alice).contentType("application/json").content("{\"levelIds\":[3,1,2,3]}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.entries.length()").value(3))
            .andExpect(jsonPath("$.entries[0].unlockedAt").value((String)JsonPath.read(before,"$.entries[0].unlockedAt")));
        assertThat((java.util.List<?>)JsonPath.read(album(bob),"$.entries")).isEmpty();
        assertThat((java.util.List<?>)JsonPath.read(album(login("alice-code")),"$.entries")).hasSize(3);
    }
    @Test void invalidIdsAndMalformedBodiesDoNotPartiallyMerge() throws Exception {
        String token=login("alice-code");
        for(String body:new String[]{"{\"levelIds\":[1,13]}","{\"levelIds\":[0]}","{\"levelIds\":[null]}","{}","null","{\"levelIds\":[1.5]}","{\"levelIds\":[\"1\"]}"}) {
            api.perform(post("/api/album/merge").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        }
        for(String body:new String[]{"{}","{\"levelId\":-1}","{\"levelId\":13}","{\"levelId\":1.5}","{\"levelId\":\"1\"}"}) {
            api.perform(post("/api/album/complete").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        }
        assertThat((java.util.List<?>)JsonPath.read(album(token),"$.entries")).isEmpty();
    }
    @Test void expiredAndRevokedSessionsAreRejected() throws Exception {
        String token=login("alice-code");
        jdbc.update("update sessions set expires_at=?",Instant.now().minusSeconds(1).toString());
        api.perform(get("/api/album").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
        token=login("alice-code");
        api.perform(post("/api/auth/logout").header("Authorization","Bearer "+token)).andExpect(status().isNoContent());
        api.perform(get("/api/album").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());
    }
    @Test void invalidCodeAndUnavailableGatewayReturnGenericErrorsWithoutSessions() throws Exception {
        api.perform(post("/api/auth/wechat").contentType("application/json").content("{\"code\":\"bad\"}"))
            .andExpect(status().isUnauthorized()).andExpect(content().json("{\"error\":\"wechat_login_failed\"}"));
        api.perform(post("/api/auth/wechat").contentType("application/json").content("{\"code\":\"offline\"}"))
            .andExpect(status().isServiceUnavailable());
        api.perform(post("/api/auth/wechat").contentType("application/json").content("{\"code\":\" \"}"))
            .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select count(*) from sessions",Integer.class)).isZero();
    }
}
