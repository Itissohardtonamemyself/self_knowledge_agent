from __future__ import annotations

import hashlib
import base64
import os
import re
from typing import Optional

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    _HAS_CRYPTO = True
except Exception:  # pragma: no cover
    _HAS_CRYPTO = False

from .config import settings

_SENSITIVE_PATTERNS = [
    (re.compile(r"1[3-9]\d{9}"), "[PHONE]"),
    (re.compile(r"\d{17}[\dXx]"), "[ID_CARD]"),
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}"), "[EMAIL]"),
]


def sha256_hex(text: str, length: int = 16) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:length]


def derive_key_from_password(password: str, salt: Optional[bytes] = None) -> tuple[bytes, bytes]:
    """基于密码派生 256-bit AES 密钥 (Argon2 回退为 PBKDF2)"""
    if not password:
        password = "default_insecure_password_change_me"
    if salt is None:
        salt = os.urandom(16)
    try:
        import argon2.low_level  # type: ignore
        key = argon2.low_level.hash_secret_raw(
            secret=password.encode("utf-8"),
            salt=salt,
            time_cost=2,
            memory_cost=102400,
            parallelism=8,
            hash_len=32,
            type=argon2.low_level.Type.ID,
        )
        return key, salt
    except Exception:
        from hashlib import pbkdf2_hmac
        key = pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000, dklen=32)
        return key, salt


def encrypt_bytes(plaintext: bytes, password: Optional[str] = None) -> bytes:
    """AES-256-GCM 加密, 返回 salt(16) + iv(12) + tag(16) + ciphertext"""
    if not _HAS_CRYPTO:
        return base64.b64encode(plaintext)  # pragma: no cover
    pwd = password or settings.privacy.master_password
    key, salt = derive_key_from_password(pwd)
    aes = AESGCM(key)
    iv = os.urandom(12)
    ct = aes.encrypt(iv, plaintext, None)
    return salt + iv + ct


def decrypt_bytes(data: bytes, password: Optional[str] = None) -> bytes:
    if not _HAS_CRYPTO:
        return base64.b64decode(data)  # pragma: no cover
    pwd = password or settings.privacy.master_password
    salt, iv, ct = data[:16], data[16:28], data[28:]
    key, _ = derive_key_from_password(pwd, salt)
    aes = AESGCM(key)
    return aes.decrypt(iv, ct, None)


def encrypt_text(text: str, password: Optional[str] = None) -> str:
    return base64.b64encode(encrypt_bytes(text.encode("utf-8"), password)).decode("ascii")


def decrypt_text(ciphertext: str, password: Optional[str] = None) -> str:
    return decrypt_bytes(base64.b64decode(ciphertext), password).decode("utf-8")


def mask_sensitive(text: str) -> str:
    """脱敏文本中的敏感字段"""
    if not settings.privacy.mask_sensitive_fields or not text:
        return text
    for pattern, replacement in _SENSITIVE_PATTERNS:
        text = pattern.sub(replacement, text)
    return text
