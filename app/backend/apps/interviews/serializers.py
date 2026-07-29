from rest_framework import serializers
from .models import AnswerList, Campaign, Interview, InterviewTemplate
from apps.users.models import Service, Site, User
from apps.users.serializers import UserSerializer


ALLOWED_QUESTION_TYPES = {"textarea", "rating", "yesno", "table", "dropdown"}


class AnswerListSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerList
        fields = ["id", "name", "items"]

    def validate_items(self, value):
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            raise serializers.ValidationError("items doit être une liste de textes.")
        return value


class InterviewTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewTemplate
        fields = ["id", "name", "type", "description", "sections", "version", "created_at", "updated_at"]
        read_only_fields = ["version", "created_at", "updated_at"]

    def validate_sections(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("sections doit être une liste de sections.")

        for section in value:
            if not isinstance(section, dict):
                raise serializers.ValidationError("Chaque section doit être un objet.")
            if not section.get("id") or not section.get("title"):
                raise serializers.ValidationError(
                    "Chaque section doit avoir un 'id' et un 'title'."
                )

            questions = section.get("questions", [])
            if not isinstance(questions, list):
                raise serializers.ValidationError(
                    f"La section '{section['id']}' doit avoir une liste 'questions'."
                )
            for question in questions:
                if not isinstance(question, dict) or not question.get("id") or not question.get("label"):
                    raise serializers.ValidationError(
                        f"Chaque question de la section '{section['id']}' doit avoir "
                        "un 'id' et un 'label'."
                    )
                qtype = question.get("type", "textarea")
                if qtype not in ALLOWED_QUESTION_TYPES:
                    raise serializers.ValidationError(
                        f"Type de question invalide dans la section '{section['id']}' : "
                        f"'{qtype}' (autorisés : {', '.join(sorted(ALLOWED_QUESTION_TYPES))})."
                    )

        return value


class CampaignSerializer(serializers.ModelSerializer):
    interview_count = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "template", "description",
            "start_date", "due_date", "population_filter",
            "interview_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_interview_count(self, obj):
        return obj.interviews.count()

    def validate_population_filter(self, value):
        if not isinstance(value, dict):
            return value

        invalid = []

        site_id = value.get("site")
        if site_id and not Site.objects.filter(pk=site_id).exists():
            invalid.append(f"site {site_id}")

        service_id = value.get("service")
        if service_id and not Service.objects.filter(pk=service_id).exists():
            invalid.append(f"service {service_id}")

        employee_ids = value.get("employees")
        if employee_ids:
            existing_ids = set(
                User.objects.filter(pk__in=employee_ids).values_list("id", flat=True)
            )
            missing_ids = [e for e in employee_ids if e not in existing_ids]
            if missing_ids:
                invalid.append(f"employé(s) {missing_ids}")

        if invalid:
            raise serializers.ValidationError(
                f"population_filter référence des enregistrements inexistants : {', '.join(invalid)}"
            )

        return value


class InterviewSerializer(serializers.ModelSerializer):
    employee_detail = UserSerializer(source="employee", read_only=True)
    manager_detail = UserSerializer(source="manager", read_only=True)
    template_name = serializers.CharField(source="template.name", read_only=True, default="")
    template_sections = serializers.SerializerMethodField()
    employee_manager_name = serializers.SerializerMethodField()
    employee_manager_id = serializers.SerializerMethodField()
    document_url = serializers.SerializerMethodField()
    previous_content = serializers.SerializerMethodField()
    career = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()
    training_history = serializers.SerializerMethodField()
    salary_history = serializers.SerializerMethodField()

    class Meta:
        model = Interview
        fields = [
            "id", "employee", "employee_detail",
            "manager", "manager_detail",
            "campaign", "template", "template_name", "template_sections",
            "employee_manager_name", "employee_manager_id",
            "type", "status", "due_date", "date_realisation", "content",
            "document_url",
            "previous_content",
            "career",
            "history",
            "training_history",
            "salary_history",
            "created_at", "updated_at",
        ]
        read_only_fields = ["manager", "created_at", "updated_at"]

    def get_template_sections(self, obj):
        return obj.get_effective_template_sections()

    def get_employee_manager_name(self, obj):
        if obj.employee.manager:
            return obj.employee.manager.get_full_name() or obj.employee.manager.email
        return None

    def get_employee_manager_id(self, obj):
        if obj.employee.manager:
            return obj.employee.manager.id
        return None

    def get_document_url(self, obj):
        if obj.document:
            return f"/media/{obj.document.name}"
        return None

    def get_previous_content(self, obj):
        prev = (
            Interview.objects.filter(employee=obj.employee, type=obj.type, status__in=("completed", "signed"))
            .exclude(pk=obj.pk)
            .order_by("-updated_at")
            .first()
        )
        if prev:
            return prev.content.get("sections", [])
        return []

    def get_history(self, obj):
        from datetime import timedelta
        from django.utils import timezone
        six_years_ago = timezone.now() - timedelta(days=365.25 * 6)
        past_interviews = (
            Interview.objects.filter(
                employee=obj.employee,
                status__in=("completed", "signed"),
                created_at__gte=six_years_ago,
            )
            .exclude(pk=obj.pk)
            .select_related("manager")
            .order_by("-created_at")[:6]
        )
        return [
            {
                "date": iv.created_at,
                "type": iv.type,
                "type_label": iv.get_type_display(),
                "status": iv.status,
                "status_label": iv.get_status_display(),
                "manager_name": (iv.manager.get_full_name() or iv.manager.email) if iv.manager else None,
            }
            for iv in past_interviews
        ]

    def get_career(self, obj):
        if obj.type == "professional":
            career_interviews = Interview.objects.filter(
                employee=obj.employee, type="professional",
                status__in=("completed", "signed"),
            ).exclude(pk=obj.pk).order_by("created_at")
        elif obj.type == "bilan":
            career_interviews = Interview.objects.filter(
                employee=obj.employee, status__in=("completed", "signed"),
            ).exclude(pk=obj.pk).order_by("created_at")
        else:
            return []
        return [
            {
                "date": iv.created_at,
                "type": iv.type,
                "type_label": iv.get_type_display(),
                "position": iv.content.get("employee_snapshot", {}).get("position"),
                "service": iv.content.get("employee_snapshot", {}).get("service"),
                "site": iv.content.get("employee_snapshot", {}).get("site"),
                "coefficient": iv.content.get("employee_snapshot", {}).get("coefficient"),
            }
            for iv in career_interviews
        ]

    def get_training_history(self, obj):
        if obj.type != "bilan":
            return []
        from datetime import timedelta
        from django.utils import timezone
        six_years_ago = timezone.now() - timedelta(days=365.25 * 6)
        past = Interview.objects.filter(
            employee=obj.employee, status__in=("completed", "signed"),
            created_at__gte=six_years_ago,
        ).exclude(pk=obj.pk).order_by("created_at")
        result = []
        for iv in past:
            entries = []
            for section in iv.content.get("sections", []):
                for q in section.get("questions", []):
                    qid = q.get("id", "")
                    if any(kw in qid for kw in ["formation", "cpf", "vae", "certif"]):
                        if q.get("answer"):
                            entries.append({
                                "label": q.get("label", qid),
                                "answer": q.get("answer", ""),
                            })
            if entries:
                result.append({
                    "date": iv.created_at,
                    "type": iv.get_type_display(),
                    "entries": entries,
                })
        return result

    def get_salary_history(self, obj):
        if obj.type != "bilan":
            return []
        from datetime import timedelta
        from django.utils import timezone
        six_years_ago = timezone.now() - timedelta(days=365.25 * 6)
        past = Interview.objects.filter(
            employee=obj.employee, status__in=("completed", "signed"),
            created_at__gte=six_years_ago,
        ).exclude(pk=obj.pk).order_by("created_at")
        return [
            {
                "date": iv.created_at,
                "type": iv.get_type_display(),
                "salary": iv.content.get("employee_snapshot", {}).get("salaire_brut"),
                "coefficient": iv.content.get("employee_snapshot", {}).get("coefficient"),
            }
            for iv in past
            if iv.content.get("employee_snapshot", {}).get("salaire_brut")
        ]
