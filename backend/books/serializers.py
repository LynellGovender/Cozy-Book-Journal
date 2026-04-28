from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Book


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user


class BookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = ['id', 'title', 'author', 'notes', 'status', 'rating', 'cover', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_rating(self, value):
        if not (0 <= value <= 5):
            raise serializers.ValidationError("Rating must be between 0 and 5.")
        return value


class StatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    tbr_count = serializers.IntegerField()
    reading_count = serializers.IntegerField()
    finished_count = serializers.IntegerField()
    avg_rating = serializers.FloatField()
    top_rated = BookSerializer(many=True)
    recent = BookSerializer(many=True)
    rated_count = serializers.IntegerField()
