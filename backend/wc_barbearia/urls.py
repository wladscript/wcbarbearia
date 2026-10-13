from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import render
from barbearia.views import RootView

def frontend_view(request):
    """Serve a aplicação SPA em Vanilla HTML/CSS/JS"""
    return render(request, "index.html")

urlpatterns = [
    # Painel Administrativo Django
    path('django-admin/', admin.site.urls),

    # API REST sob /api/
    path('api/', RootView.as_view(), name='api_root'),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('barbearia.urls')),

    # Rota raiz e SPA fallback para servir o frontend Vanilla
    re_path(r'^(?!api/|django-admin/|static/).*$', frontend_view, name='frontend_spa'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
