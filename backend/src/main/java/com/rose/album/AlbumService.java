package com.rose.album;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class AlbumService {
    public record User(String id) {}
    public record Login(String token, String expiresAt, User user) {}
    public record Entry(int levelId, String unlockedAt) {}
    public record Album(int version, List<Entry> entries) {}
    private final JdbcTemplate db;
    private final TransactionTemplate transactions;
    private final WeChatGateway gateway;
    private final long ttl;
    private final SecureRandom random=new SecureRandom();
    public AlbumService(JdbcTemplate db, TransactionTemplate transactions, WeChatGateway gateway,
                        @Value("${rose.session.ttl-seconds}") long ttl) {
        if(ttl<1 || ttl>2592000) throw new IllegalArgumentException("Session lifetime must be between 1 and 2592000 seconds");
        this.db=db; this.transactions=transactions; this.gateway=gateway; this.ttl=ttl;
    }
    // A single-instance login lock also avoids duplicate account creation for concurrent first logins.
    public synchronized Login login(String code) {
        String openid=gateway.exchange(code);
        if(openid==null || openid.isBlank() || openid.length()>128) throw new ApiFailure(401,"wechat_login_failed");
        return transactions.execute(tx->{
            var ids=db.queryForList("select id from album_users where wechat_openid=?",String.class,openid);
            String userId=ids.isEmpty()?UUID.randomUUID().toString():ids.getFirst();
            if(ids.isEmpty()) db.update("insert into album_users(id,wechat_openid) values (?,?)",userId,openid);
            var now=OffsetDateTime.now(ZoneOffset.UTC);
            db.update("delete from sessions where expires_at<=?",now);
            byte[] bytes=new byte[32]; random.nextBytes(bytes);
            String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            var expiry=now.plusSeconds(ttl);
            db.update("insert into sessions(token_hash,user_id,expires_at) values (?,?,?)",hash(token),userId,expiry);
            return new Login(token,expiry.toInstant().toString(),new User(userId));
        });
    }
    public String authenticate(String header) {
        if(header==null || !header.matches("Bearer [A-Za-z0-9_-]{43}")) throw new ApiFailure(401,"unauthorized");
        var ids=db.queryForList("select user_id from sessions where token_hash=? and expires_at>?",String.class,
            hash(header.substring(7)),OffsetDateTime.now(ZoneOffset.UTC));
        if(ids.size()!=1) throw new ApiFailure(401,"unauthorized");
        return ids.getFirst();
    }
    public void logout(String header) {
        authenticate(header);
        db.update("delete from sessions where token_hash=?",hash(header.substring(7)));
    }
    public Album album(String userId) {
        return new Album(1,db.query("select level_id,unlocked_at from album_entries where user_id=? order by level_id",
            (rs,n)->new Entry(rs.getInt(1),rs.getObject(2,OffsetDateTime.class).toInstant().toString()),userId));
    }
    public Album merge(String userId,List<Integer> levelIds) {
        return transactions.execute(tx->{
            db.queryForObject("select id from album_users where id=? for update",String.class,userId);
            var time=OffsetDateTime.now(ZoneOffset.UTC);
            for(int id:new LinkedHashSet<>(levelIds)) {
                db.update("insert into album_entries(user_id,level_id,unlocked_at) select ?,?,? where not exists (select 1 from album_entries where user_id=? and level_id=?)",
                    userId,id,time,userId,id);
            }
            return album(userId);
        });
    }
    private static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 unavailable"); }
    }
}
