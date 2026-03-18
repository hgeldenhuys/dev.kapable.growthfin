# SignalDB Connect - App Hosting
# Routes *.signaldb.app to user app containers
#
# Installation:
#   sudo cp signaldb.app /etc/nginx/sites-available/
#   sudo ln -s /etc/nginx/sites-available/signaldb.app /etc/nginx/sites-enabled/
#   sudo nginx -t && sudo systemctl reload nginx

server {
    listen 80;
    server_name ~^(?<subdomain>.+)\.signaldb\.app$;

    # Logs
    access_log /var/log/nginx/signaldb.app.access.log;
    error_log /var/log/nginx/signaldb.app.error.log;

    location / {
        proxy_pass http://127.0.0.1:3003;

        # Pass subdomain to API for routing
        proxy_set_header X-Connect-Subdomain $subdomain;
        proxy_set_header X-Original-URI $request_uri;

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # SSE support
        proxy_buffering off;
        proxy_cache off;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 3600s; # Long timeout for SSE
    }
}
