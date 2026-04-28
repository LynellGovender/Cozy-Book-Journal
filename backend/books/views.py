from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import Avg, Count
from .models import Book
from .serializers import BookSerializer, RegisterSerializer, StatsSerializer


# ─── Auth ────────────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'username': user.username,
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'username': user.username,
            })
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


# ─── Books ────────────────────────────────────────────────────────────────────

class BookListCreateView(generics.ListCreateAPIView):
    serializer_class = BookSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Book.objects.filter(user=self.request.user)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BookDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BookSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Book.objects.filter(user=self.request.user)


# ─── Stats ────────────────────────────────────────────────────────────────────

class StatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        books = Book.objects.filter(user=request.user)
        counts = books.aggregate(
            tbr=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(status='TBR')),
            reading=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(status='Reading')),
            finished=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(status='Finished')),
        )
        rated = books.filter(rating__gt=0)
        avg = rated.aggregate(avg=Avg('rating'))['avg'] or 0

        data = {
            'total': books.count(),
            'tbr_count': counts['tbr'],
            'reading_count': counts['reading'],
            'finished_count': counts['finished'],
            'avg_rating': round(avg, 2),
            'rated_count': rated.count(),
            'top_rated': BookSerializer(books.filter(rating__gt=0).order_by('-rating')[:5], many=True).data,
            'recent': BookSerializer(books.order_by('-created_at')[:5], many=True).data,
        }
        return Response(data)
