server:
	source venv/bin/activate; foreman start;

prodf:
	git push heroku master
	heroku config:set SP_ENV=production --account suprizr-web

prod:
	make prodf

logs:
	heroku logs --tail --account suprizr-web
