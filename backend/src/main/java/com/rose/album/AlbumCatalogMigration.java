package com.rose.album;

import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@DependsOnDatabaseInitialization
class AlbumCatalogMigration {
    AlbumCatalogMigration(JdbcTemplate jdbc) {
        extendLevelRange(jdbc);
    }

    static void extendLevelRange(JdbcTemplate jdbc) {
        var legacy = jdbc.queryForList("""
            SELECT c.CONSTRAINT_NAME
            FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS c
            JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS t
              USING (CONSTRAINT_CATALOG, CONSTRAINT_SCHEMA, CONSTRAINT_NAME)
            WHERE t.TABLE_SCHEMA = CURRENT_SCHEMA()
              AND t.TABLE_NAME = 'ALBUM_ENTRIES'
              AND REPLACE(c.CHECK_CLAUSE, '"', '') = 'LEVEL_ID BETWEEN 1 AND 10'
            """, String.class);
        for (String name : legacy) {
            String identifier = "\"" + name.replace("\"", "\"\"") + "\"";
            jdbc.execute("ALTER TABLE album_entries DROP CONSTRAINT IF EXISTS " + identifier);
        }
    }
}
