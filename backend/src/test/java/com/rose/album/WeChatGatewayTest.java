package com.rose.album;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class WeChatGatewayTest {
    @Test void missingCredentialsFailClosed() {
        assertThatThrownBy(()->new HttpWeChatGateway("","",RestClient.builder()).exchange("code"))
            .isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(503));
    }
    @Test void exchangesCodeOnlyAtOfficialEndpointAndReturnsOnlyOpenId() {
        var builder=RestClient.builder(); var server=MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.weixin.qq.com/sns/jscode2session?appid=app&secret=secret&js_code=code&grant_type=authorization_code"))
            .andRespond(withSuccess("{\"openid\":\"private-openid\",\"session_key\":\"sensitive\"}",MediaType.APPLICATION_JSON));
        assertThat(new HttpWeChatGateway("app","secret",builder).exchange("code")).isEqualTo("private-openid");
        server.verify();
    }
    @Test void invalidCodesAreGenericAndUpstreamFailuresAreUnavailable() {
        for(String response:new String[]{"{\"errcode\":40029,\"errmsg\":\"sensitive detail\"}","{}","{\"openid\":\"\"}","{\"openid\":12}","{\"openid\":\"without-session-key\"}"}) {
            var builder=RestClient.builder(); var server=MockRestServiceServer.bindTo(builder).build();
            server.expect(anything()).andRespond(withSuccess(response,MediaType.APPLICATION_JSON));
            assertThatThrownBy(()->new HttpWeChatGateway("a","s",builder).exchange("c"))
                .isInstanceOfSatisfying(ApiFailure.class,e->{ assertThat(e.status).isEqualTo(401); assertThat(e.getMessage()).isEqualTo("wechat_login_failed"); });
        }
        var builder=RestClient.builder(); var server=MockRestServiceServer.bindTo(builder).build();
        server.expect(anything()).andRespond(withServerError());
        assertThatThrownBy(()->new HttpWeChatGateway("a","s",builder).exchange("c"))
            .isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(503));
    }
}
