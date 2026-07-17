import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

INSECURE_DEFAULT_SECRET_KEY = "insecure-dev-key-change-in-prod"

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", INSECURE_DEFAULT_SECRET_KEY)
DEBUG = os.environ.get("DEBUG", "True") == "True"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "*").split(",")

if not DEBUG:
    if SECRET_KEY == INSECURE_DEFAULT_SECRET_KEY:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY doit être défini explicitement quand DEBUG=False."
        )
    if ALLOWED_HOSTS == ["*"]:
        raise ImproperlyConfigured(
            "ALLOWED_HOSTS doit être défini explicitement quand DEBUG=False."
        )

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "mozilla_django_oidc",
    "apps.users",
    "apps.interviews",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "isboard"),
        "USER": os.environ.get("DB_USER", "isboard"),
        "PASSWORD": os.environ.get("DB_PASSWORD", "isboard"),
        "HOST": os.environ.get("DB_HOST", "db"),
        "PORT": os.environ.get("DB_PORT", "5432"),
    }
}

AUTH_USER_MODEL = "users.User"

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
]

if os.environ.get("OIDC_CLIENT_ID") and os.environ.get("OIDC_OP_JWKS_ENDPOINT"):
    AUTHENTICATION_BACKENDS.append("apps.users.backends.OIDCAuthenticationBackend")

OIDC_RP_CLIENT_ID = os.environ.get("OIDC_CLIENT_ID")
OIDC_RP_CLIENT_SECRET = os.environ.get("OIDC_CLIENT_SECRET")
OIDC_OP_AUTHORIZATION_ENDPOINT = os.environ.get("OIDC_OP_AUTHORIZATION_ENDPOINT")
OIDC_OP_TOKEN_ENDPOINT = os.environ.get("OIDC_OP_TOKEN_ENDPOINT")
OIDC_OP_USER_ENDPOINT = os.environ.get("OIDC_OP_USER_ENDPOINT")
OIDC_OP_JWKS_ENDPOINT = os.environ.get("OIDC_OP_JWKS_ENDPOINT")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5175")
ISBIBLIOTHEQUE_URL = os.environ.get("ISBIBLIOTHEQUE_URL", "")
OIDC_REDIRECT_URI = os.environ.get("OIDC_REDIRECT_URI")
OIDC_RP_SCOPES = "openid email profile"
OIDC_RP_SIGN_ALGO = "RS256"
OIDC_RP_IDP_SIGN_KEY = None
OIDC_RP_CALLBACK_ENDPOINT = "/api/auth/callback"
OIDC_CALLBACK_CLASS = "apps.users.views.OIDCCallbackView"
LOGIN_URL = "oidc_authentication_init"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "dev_login": "5/min",
    },
}

SIMPLE_JWT = {
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ["Content-Disposition"]

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "loggers": {
        "apps.users.backends": {
            "handlers": ["console"],
            "level": "INFO",
        },
        "apps.users.views": {
            "handlers": ["console"],
            "level": "WARNING",
        },
    },
}

# Reverse proxy settings
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Force OIDC redirect URI
USE_X_FORWARDED_PORT = True
