package com.rose.album;
final class ApiFailure extends RuntimeException {
    final int status;
    final String code;
    ApiFailure(int status, String code) { super(code); this.status=status; this.code=code; }
}
