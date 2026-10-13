from django.urls import path
from .views import RegisterView, LoginView, MeView, LogoutView

urlpatterns = [
    path('register', RegisterView.as_view(), name='auth_register'),
    path('login', LoginView.as_view(), name='auth_login'),
    path('me', MeView.as_view(), name='auth_me'),
    path('logout', LogoutView.as_view(), name='auth_logout'),
]
