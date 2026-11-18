package com.rose.album;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api")
public class AlbumController {
    private final AlbumService service;
    public AlbumController(AlbumService service) { this.service=service; }
    public record CodeRequest(Object code) {}
    public record CompleteRequest(Object levelId) {}
    public record MergeRequest(List<?> levelIds) {}
    @GetMapping("/health") public Map<String,String> health() { return Map.of("status","ok"); }
    @PostMapping("/auth/wechat") public AlbumService.Login login(@RequestBody CodeRequest request) {
        if(request==null || !(request.code() instanceof String code) || code.isBlank() || code.length()>512) throw invalid();
        return service.login(code);
    }
    @GetMapping("/album") public AlbumService.Album album(@RequestHeader(value="Authorization",required=false) String auth) {
        return service.album(service.authenticate(auth));
    }
    @PostMapping("/album/complete") public AlbumService.Album complete(@RequestHeader(value="Authorization",required=false) String auth,@RequestBody CompleteRequest request) {
        String user=service.authenticate(auth);
        if(request==null) throw invalid();
        return service.merge(user,List.of(levelId(request.levelId())));
    }
    @PostMapping("/album/merge") public AlbumService.Album merge(@RequestHeader(value="Authorization",required=false) String auth,@RequestBody MergeRequest request) {
        String user=service.authenticate(auth);
        if(request==null || request.levelIds()==null || request.levelIds().size()>100) throw invalid();
        var ids=request.levelIds().stream().map(AlbumController::levelId).toList();
        return service.merge(user,ids);
    }
    @PostMapping("/auth/logout") public ResponseEntity<Void> logout(@RequestHeader(value="Authorization",required=false) String auth) {
        service.logout(auth); return ResponseEntity.noContent().build();
    }
    private static int levelId(Object value) {
        if(!(value instanceof Integer id) || id<1 || id>12) throw invalid();
        return id;
    }
    private static ApiFailure invalid() { return new ApiFailure(400,"invalid_request"); }
}

@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(ApiFailure.class) ResponseEntity<Map<String,String>> handle(ApiFailure failure) {
        return ResponseEntity.status(failure.status).body(Map.of("error",failure.code));
    }
    @ExceptionHandler(HttpMessageNotReadableException.class) ResponseEntity<Map<String,String>> invalid() {
        return ResponseEntity.badRequest().body(Map.of("error","invalid_request"));
    }
}
