server:
	source venv/bin/activate; python app.py;

prodf:
	./deploy_prod.sh

prod:
	make prodf

logs:
	heroku logs --tail --account suprizr-web
