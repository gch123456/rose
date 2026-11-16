package com.rose.album;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

class PersistenceTest {
    @TempDir Path directory;
    AlbumService service(String url) {
        var ds=new DriverManagerDataSource(url,"sa","");
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);
        return new AlbumService(new JdbcTemplate(ds),new TransactionTemplate(new DataSourceTransactionManager(ds)),code->"wx-persisted",3600);
    }
    @Test void fileDatabaseRetainsIdentityAlbumAndSessionAcrossReopen() {
        String url="jdbc:h2:file:"+directory.resolve("album");
        var first=service(url); var login=first.login("code");
        var album=first.merge(login.user().id(),List.of(2,1));
        var reopened=service(url);
        assertThat(reopened.authenticate("Bearer "+login.token())).isEqualTo(login.user().id());
        assertThat(reopened.album(login.user().id())).isEqualTo(album);
        assertThat(reopened.login("another-code").user()).isEqualTo(login.user());
    }
    @Test void concurrentCompletionsPreserveOneEntryAndFirstTimestamp() throws Exception {
        var service=service("jdbc:h2:mem:concurrent;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000");
        var login=service.login("code"); String user=login.user().id();
        var first=service.merge(user,List.of(1));
        try(var threads=Executors.newFixedThreadPool(6)) {
            var tasks=java.util.stream.IntStream.range(0,12).<Callable<AlbumService.Album>>mapToObj(n->()->service.merge(user,List.of(1,2))).toList();
            for(var result:threads.invokeAll(tasks)) assertThat(result.get().entries()).hasSize(2);
        }
        assertThat(service.album(user).entries().getFirst()).isEqualTo(first.entries().getFirst());
    }
}
