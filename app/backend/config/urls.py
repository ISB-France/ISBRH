from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView
from apps.users.views import OIDCAuthenticationRequestView, OIDCCallbackView, MeView, UserViewSet, SiteViewSet, ServiceViewSet, PositionViewSet, NotificationViewSet, DevLoginView, LogoutView, ProfileAvatarView, SSOLoginView
from apps.interviews.views import CampaignViewSet, InterviewTemplateViewSet, InterviewViewSet
from apps.evp.views import AbsenceViewSet, BadgeAuthView, ClotureMensuelleStatutView, JourTravailleViewSet

router = DefaultRouter()
router.register("interviews", InterviewViewSet, basename="interview")
router.register("users", UserViewSet, basename="user")
router.register("sites", SiteViewSet, basename="site")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/authenticate/", OIDCAuthenticationRequestView.as_view(), name="oidc_authentication_init"),
    path("api/auth/callback", OIDCCallbackView.as_view(), name="oidc_authentication_callback"),
    path("api/auth/callback/", OIDCCallbackView.as_view(), name="oidc_authentication_callback_slash"),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("api/auth/me/", MeView.as_view(), name="auth_me"),
    path("api/auth/profile/avatar/", ProfileAvatarView.as_view(), name="auth_profile_avatar"),
    path("api/auth/sso/", SSOLoginView.as_view(), name="auth_sso"),
    path("api/auth/dev-login/", DevLoginView.as_view(), name="auth_dev_login"),
    path("api/auth/logout/", LogoutView.as_view(), name="auth_logout"),
    path("api/services/", ServiceViewSet.as_view({"get": "list", "post": "create"}), name="service-list"),
    path("api/services/<int:pk>/", ServiceViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}), name="service-detail"),
    path("api/positions/", PositionViewSet.as_view({"get": "list", "post": "create"}), name="position-list"),
    path("api/positions/<int:pk>/", PositionViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}), name="position-detail"),
    path("api/interview-templates/", InterviewTemplateViewSet.as_view({"get": "list", "post": "create"}), name="interviewtemplate-list"),
    path("api/interview-templates/import_csv/", InterviewTemplateViewSet.as_view({"post": "import_csv"}), name="interviewtemplate-import-csv"),
    path("api/interview-templates/<int:pk>/", InterviewTemplateViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}), name="interviewtemplate-detail"),
    path("api/notifications/", NotificationViewSet.as_view({"get": "list"}), name="notification-list"),
    path("api/notifications/<int:pk>/mark-read/", NotificationViewSet.as_view({"post": "mark_read"}), name="notification-mark-read"),
    path("api/notifications/mark-all-read/", NotificationViewSet.as_view({"post": "mark_all_read"}), name="notification-mark-all-read"),
    path("api/campaigns/", CampaignViewSet.as_view({"get": "list", "post": "create"}), name="campaign-list"),
    path("api/campaigns/export_xlsx/", CampaignViewSet.as_view({"get": "export_xlsx"}), name="campaign-export-xlsx"),
    path("api/campaigns/export_all_contents_xlsx/", CampaignViewSet.as_view({"get": "export_all_contents_xlsx"}), name="campaign-export-all-contents-xlsx"),
    path("api/campaigns/<int:pk>/", CampaignViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}), name="campaign-detail"),
    path("api/campaigns/<int:pk>/generate/", CampaignViewSet.as_view({"post": "generate"}), name="campaign-generate"),
    path("api/campaigns/<int:pk>/delete_all_interviews/", CampaignViewSet.as_view({"post": "delete_all_interviews"}), name="campaign-delete-all-interviews"),
    path("api/campaigns/<int:pk>/reassign_managers/", CampaignViewSet.as_view({"post": "reassign_managers"}), name="campaign-reassign-managers"),
    path("api/campaigns/<int:pk>/export_contents_xlsx/", CampaignViewSet.as_view({"get": "export_contents_xlsx"}), name="campaign-export-contents-xlsx"),
    path("api/evp/badge-auth/", BadgeAuthView.as_view(), name="evp-badge-auth"),
    path("api/evp/jours-travailles/", JourTravailleViewSet.as_view({"get": "list"}), name="evp-jourtravaille-list"),
    path("api/evp/jours-travailles/<int:pk>/", JourTravailleViewSet.as_view({"patch": "partial_update"}), name="evp-jourtravaille-detail"),
    path("api/evp/absences/", AbsenceViewSet.as_view({"get": "list", "post": "create"}), name="evp-absence-list"),
    path("api/evp/cloture-mensuelle/", ClotureMensuelleStatutView.as_view(), name="evp-cloture-mensuelle"),
    path("api/", include(router.urls)),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
