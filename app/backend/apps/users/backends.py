import logging

from django.conf import settings
from django.core.exceptions import SuspiciousOperation

from mozilla_django_oidc.auth import OIDCAuthenticationBackend as BaseOIDCBackend

logger = logging.getLogger(__name__)


class OIDCAuthenticationBackend(BaseOIDCBackend):
    def authenticate(self, request, **kwargs):
        redirect_uri = getattr(settings, "OIDC_REDIRECT_URI", None)
        if not redirect_uri:
            return super().authenticate(request, **kwargs)

        self.request = request
        if not self.request:
            return None

        state = self.request.GET.get("state")
        code = self.request.GET.get("code")
        nonce = kwargs.pop("nonce", None)
        code_verifier = kwargs.pop("code_verifier", None)

        if not code or not state:
            return None

        token_payload = {
            "client_id": self.OIDC_RP_CLIENT_ID,
            "client_secret": self.OIDC_RP_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }

        if code_verifier is not None:
            token_payload.update({"code_verifier": code_verifier})

        token_info = self.get_token(token_payload)
        id_token = token_info.get("id_token")
        access_token = token_info.get("access_token")

        payload = self.verify_token(id_token, nonce=nonce)

        if payload:
            self.store_tokens(access_token, id_token)
            try:
                return self.get_or_create_user(access_token, id_token, payload)
            except SuspiciousOperation as exc:
                logger.warning("failed to get or create user: %s", exc)
                return None

        return None

    def create_user(self, claims):
        email = claims.get("email") or claims.get("preferred_username")
        logger.info("OIDC create_user - claims: %s", claims)
        logger.info("OIDC create_user - email: %s", email)
        user = self.UserModel.objects.create_user(
            username=email or f"user-{claims.get('sub', 'unknown')}",
            email=email or f"{claims.get('sub', 'unknown')}@placeholder.isb",
        )
        self.update_user(user, claims)
        return user

    def update_user(self, user, claims):
        user.first_name = claims.get("given_name", "") or user.first_name
        user.last_name = claims.get("family_name", "") or user.last_name
        email = claims.get("email") or claims.get("preferred_username")
        if email:
            user.email = email

        roles = claims.get("roles", [])
        if roles:
            if "rh" in roles or "admin" in roles:
                user.role = self.UserModel.Role.RH
            elif "manager" in roles:
                user.role = self.UserModel.Role.MANAGER
            else:
                user.role = self.UserModel.Role.EMPLOYEE

        user.save()
        return user

    def get_or_create_user(self, access_token, id_token, payload):
        user_info = payload
        if self.OIDC_OP_USER_ENDPOINT:
            try:
                user_info = self.get_userinfo(access_token, id_token, payload)
            except Exception:
                user_info = payload

        claims_verified = self.verify_claims(user_info)
        if not claims_verified:
            msg = "Claims verification failed"
            raise SuspiciousOperation(msg)

        users = self.filter_users_by_claims(user_info)
        if len(users) == 1:
            return self.update_user(users[0], user_info)
        elif len(users) > 1:
            return
        elif self.get_settings("OIDC_CREATE_USER", True):
            return self.create_user(user_info)
        return

    def filter_users_by_claims(self, claims):
        email = claims.get("email") or claims.get("preferred_username")
        logger.info("OIDC filter_users_by_claims - email: %s", email)
        if not email:
            return self.UserModel.objects.none()
        return self.UserModel.objects.filter(email__iexact=email)
