import os
import base64
import platform
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

# Fixed salt for machine-specific key derivation. Do not change.
MACHINE_SALT = b"prephelper_local_salt_1298471"

def get_machine_key() -> bytes:
    # Derives a 32-byte key from platform.node()
    node_name = platform.node() or "prephelper_fallback_node"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=MACHINE_SALT,
        iterations=100000,
    )
    return kdf.derive(node_name.encode("utf-8"))

def encrypt_string(plaintext: str) -> str:
    """Encrypts a plaintext string using the machine key. Returns base64 representation of nonce + ciphertext."""
    if not plaintext:
        return ""
    key = get_machine_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    packed = nonce + ciphertext
    return base64.b64encode(packed).decode("utf-8")

def decrypt_string(ciphertext_b64: str) -> str:
    """Decrypts a base64 ciphertext using the machine key. Returns plaintext string."""
    if not ciphertext_b64:
        return ""
    key = get_machine_key()
    aesgcm = AESGCM(key)
    packed = base64.b64decode(ciphertext_b64.encode("utf-8"))
    nonce = packed[:12]
    ciphertext = packed[12:]
    plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext_bytes.decode("utf-8")

def derive_key_from_passphrase(passphrase: str, salt: bytes) -> bytes:
    """Derive a 32-byte key from a passphrase and salt using PBKDF2-HMAC-SHA256."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=600000,
    )
    return kdf.derive(passphrase.encode("utf-8"))

def encrypt_vault_payload(data: bytes, passphrase: str) -> tuple[bytes, bytes, bytes]:
    """Encrypts a vault payload using a user-provided passphrase.
    Returns tuple of (ciphertext, nonce, salt).
    """
    salt = os.urandom(16)
    key = derive_key_from_passphrase(passphrase, salt)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, data, None)
    return ciphertext, nonce, salt

def decrypt_vault_payload(ciphertext: bytes, nonce: bytes, salt: bytes, passphrase: str) -> bytes:
    """Decrypts a vault payload using a user-provided passphrase."""
    key = derive_key_from_passphrase(passphrase, salt)
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None)
