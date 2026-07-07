import logging

from django.conf import settings

from mozilla_django_oidc.auth import OIDCAuthenticationBackend as BaseOIDCBackend

logger = logging.getLogger(__name__)


class OIDCAuthenticationBackend(BaseOIDCBackend):
    def get_redirect_uri(self, request):
        return getattr(settings, "OIDC_REDIRECT_URI", None) or super().get_redirect_uri(request)

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
            from django.core.exceptions import SuspiciousOperation
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
