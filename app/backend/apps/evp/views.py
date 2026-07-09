from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import RH_ROLES, User
from apps.users.serializers import UserMeSerializer
from apps.users.views import get_subordinate_ids

from .models import Absence, ClotureMensuelle, JourTravaille, MoisClotureError, check_month_not_closed
from .serializers import AbsenceSerializer, JourTravailleCorrectionSerializer, JourTravailleSerializer
from .services.correction import enregistrer_correction_manuelle


class BadgeAuthThrottle(AnonRateThrottle):
    scope = "evp_badge_auth"


class BadgeAuthView(APIView):
    """Point d'entree kiosque : authentifie un manager EVP par badge et
    retourne des tokens JWT via exactement le meme mecanisme que le login
    classique (RefreshToken.for_user + UserMeSerializer), pour que le
    frontend n'ait aucune difference de traitement selon le point d'entree."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [BadgeAuthThrottle]

    def post(self, request):
        code = (request.data.get("code") or "").strip()

        # Message et code de statut IDENTIQUES que le badge soit inexistant,
        # inactif, ou existant mais non autorise EVP — ne jamais laisser un
        # attaquant qui teste des codes distinguer ces cas.
        generic_error = Response(
            {"error": "Badge non reconnu"}, status=status.HTTP_404_NOT_FOUND
        )
        if not code:
            return generic_error

        user = User.objects.filter(
            code_badge=code, is_manager_evp=True, is_active=True
        ).first()
        if not user:
            return generic_error

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserMeSerializer(user).data,
        })


class IsManagerEvp(permissions.BasePermission):
    """Permission dediee : IsAuthenticated ne suffit pas, il faut la
    permission explicite is_manager_evp=True (independante de
    role='manager'), voir apps/users/models.py."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_manager_evp
        )


def _team_employee_ids(user):
    """Retourne None si l'utilisateur voit toute l'equipe (RH/Admin), sinon
    l'ensemble des ids d'employes visibles (lui-meme + ses subordonnes,
    memes regles d'ownership que /api/interviews/employees/ et
    UserViewSet.get_queryset — reutilise get_subordinate_ids plutot que de
    dupliquer cette logique)."""
    if user.role in RH_ROLES:
        return None
    ids = get_subordinate_ids(user.id)
    ids.add(user.id)
    return ids


def _scope_to_team(queryset, user, employee_field="employee_id"):
    team_ids = _team_employee_ids(user)
    if team_ids is None:
        return queryset
    return queryset.filter(**{f"{employee_field}__in": team_ids})


class JourTravailleViewSet(viewsets.ModelViewSet):
    serializer_class = JourTravailleSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerEvp]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        qs = _scope_to_team(JourTravaille.objects.all(), self.request.user)

        employee_id = self.request.query_params.get("employee")
        mois = self.request.query_params.get("mois")
        annee = self.request.query_params.get("annee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if mois:
            qs = qs.filter(date__month=mois)
        if annee:
            qs = qs.filter(date__year=annee)
        return qs

    def partial_update(self, request, *args, **kwargs):
        # get_object() s'appuie sur get_queryset() ci-dessus, deja restreint
        # a l'equipe du manager courant : un jour hors equipe est simplement
        # absent du queryset -> 404, sans reveler qu'il existe ailleurs.
        instance = self.get_object()

        try:
            check_month_not_closed(instance.employee_id, instance.date)
        except MoisClotureError:
            return Response(
                {"error": "Le mois est déjà clôturé pour cet employé : aucune modification n'est possible."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = JourTravailleCorrectionSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        motif = serializer.validated_data.get("motif_modification", "")

        for field in ("heures_travaillees_retenu", "heures_nuit_retenu"):
            if field in serializer.validated_data:
                enregistrer_correction_manuelle(
                    instance, field, serializer.validated_data[field], motif, request.user
                )

        instance.refresh_from_db()
        return Response(JourTravailleSerializer(instance).data)


class AbsenceViewSet(viewsets.ModelViewSet):
    serializer_class = AbsenceSerializer
    permission_classes = [permissions.IsAuthenticated, IsManagerEvp]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = _scope_to_team(Absence.objects.all(), self.request.user)

        employee_id = self.request.query_params.get("employee")
        mois = self.request.query_params.get("mois")
        annee = self.request.query_params.get("annee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if mois:
            qs = qs.filter(date_debut__month=mois)
        if annee:
            qs = qs.filter(date_debut__year=annee)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = AbsenceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.validated_data["employee"]

        team_ids = _team_employee_ids(request.user)
        if team_ids is not None and employee.id not in team_ids:
            return Response(
                {"error": "Ce collaborateur ne fait pas partie de votre équipe."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            check_month_not_closed(
                employee.id,
                serializer.validated_data["date_debut"],
                serializer.validated_data["date_fin"],
            )
        except MoisClotureError:
            return Response(
                {"error": "Le mois est déjà clôturé pour cet employé : aucune saisie n'est possible."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ClotureMensuelleStatutView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsManagerEvp]

    def get(self, request):
        employee_id = request.query_params.get("employee")
        mois = request.query_params.get("mois")
        annee = request.query_params.get("annee")
        if not (employee_id and mois and annee):
            return Response(
                {"error": "Les paramètres employee, mois et annee sont requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        team_ids = _team_employee_ids(request.user)
        if team_ids is not None and int(employee_id) not in team_ids:
            return Response(
                {"error": "Ce collaborateur ne fait pas partie de votre équipe."},
                status=status.HTTP_403_FORBIDDEN,
            )

        cloture = ClotureMensuelle.objects.filter(
            employee_id=employee_id, mois=mois, annee=annee
        ).first()
        # Absence de ClotureMensuelle = etat normal (mois pas encore
        # cloture), pas une erreur -> jamais de 404 ici.
        statut = cloture.statut if cloture else ClotureMensuelle.Statut.DRAFT

        return Response({
            "employee": int(employee_id),
            "mois": int(mois),
            "annee": int(annee),
            "statut": statut,
        })
