#!/bin/sh

git push heroku master
heroku config:add SP_ENV=production REL=$(heroku releases --account suprizr-web | head -2 | tail -1 | awk '{print $1}') --account suprizr-web