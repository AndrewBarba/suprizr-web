server:
	source venv/bin/activate; python app.py;

prodf:
	git push heroku master
#	heroku config:add SP_ENV=production REL=$(heroku releases --account suprizr-web | head -2 | tail -1 | awk '{print $1}') --account suprizr-web

prod:
	make prodf

logs:
	heroku logs --tail --account suprizr-web
