package com.rose.album;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:health", "spring.sql.init.mode=always"})
class HealthTest {
    @Autowired WebApplicationContext context;
    @Test void healthDoesNotDiscloseConfiguration() throws Exception {
        MockMvcBuilders.webAppContextSetup(context).build().perform(get("/api/health"))
            .andExpect(status().isOk()).andExpect(content().json("{\"status\":\"ok\"}"));
    }
}
