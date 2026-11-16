package com.rose.album;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;

@Component
public class HttpWeChatGateway implements WeChatGateway {
    private final String appId;
    private final String secret;
    private final RestClient http;
    @Autowired
    public HttpWeChatGateway(@Value("${rose.wechat.app-id}") String appId,@Value("${rose.wechat.app-secret}") String secret) {
        this(appId,secret,productionClient());
    }
    HttpWeChatGateway(String appId,String secret,RestClient.Builder builder) {
        this.appId=appId; this.secret=secret; this.http=builder.build();
    }
    private static RestClient.Builder productionClient() {
        var client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
        var factory=new JdkClientHttpRequestFactory(client);
        factory.setReadTimeout(Duration.ofSeconds(8));
        return RestClient.builder().requestFactory(factory);
    }
    @Override public String exchange(String code) {
        if(appId.isBlank() || secret.isBlank()) throw new ApiFailure(503,"wechat_unavailable");
        Map<?,?> result;
        try {
            result=http.get().uri("https://api.weixin.qq.com/sns/jscode2session?appid={appid}&secret={secret}&js_code={code}&grant_type=authorization_code",appId,secret,code)
                .retrieve().body(Map.class);
        } catch(RestClientException e) {
            // The underlying exception can contain the credential-bearing URI. Do not expose or log it.
            throw new ApiFailure(503,"wechat_unavailable");
        }
        if(result!=null && result.get("errcode") instanceof Number error && (error.intValue()==-1 || error.intValue()==45011))
            throw new ApiFailure(503,"wechat_unavailable");
        if(result==null || (result.containsKey("errcode") && !(result.get("errcode") instanceof Number n && n.intValue()==0))
            || !(result.get("session_key") instanceof String key) || key.isBlank()
            || !(result.get("openid") instanceof String openid) || openid.isBlank() || openid.length()>128)
            throw new ApiFailure(401,"wechat_login_failed");
        return openid;
    }
}
