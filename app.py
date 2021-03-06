import os
from flask import Flask, render_template, jsonify, request, redirect
import json, os, logging, random, string, gzip, StringIO

app = Flask(__name__)

def random_string(size=6, chars=string.ascii_uppercase + string.digits):
    return ''.join(random.choice(chars) for x in range(size))

def render(temp):
	return render_template(temp, version=os.environ.get('REL',random_string()))

@app.route('/')
def index():
    return render("index.html")

@app.route('/fav-meal')
def contest():
    return render("contest.html")

@app.route('/admin', defaults={'path': ''})
@app.route('/admin/<path:path>')
def admin(path=None):
	return render("admin/base.html")

def _cache(cache,response,time=False):
    if (cache):
        sec = "90000"
        if time: sec = time
        response.headers["Pragma"] = "public"
        response.headers["Cache-Control"] = "public, max-age=%s" % sec
    else:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = 0
    return response

@app.after_request
def add_header(response):
    """
    Add headers to both force latest IE rendering engine or Chrome Frame,
    and also to cache the rendered page
    """
    response.headers["X-UA-Compatible"] = "IE=Edge,chrome=1"
    response.headers["Vary"] = "Accept-Encoding"

    # Security Headers
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-Content-Type-Options"] = "nosniff"

    url = request.url
    if "/static/" in url:
        response = _cache(True,response,"31536000")
    else:
        response = _cache(False,response)

    return response

@app.after_request
def gzip_response(response):
    
    response.direct_passthrough = False

    accept_encoding = request.headers.get('Accept-Encoding', '')

    if 'gzip' not in accept_encoding.lower():
        return response

    if (200 > response.status_code >= 300) or len(response.data) < 500 or 'Content-Encoding' in response.headers:
        return response

    gzip_buffer = StringIO.StringIO()
    gzip_file = gzip.GzipFile(mode='wb', compresslevel=6, fileobj=gzip_buffer)
    gzip_file.write(response.data)
    gzip_file.close()
    response.data = gzip_buffer.getvalue()
    response.headers['Content-Encoding'] = 'gzip'
    response.headers['Content-Length'] = len(response.data)

    return response

if __name__ == '__main__':
    # needed for heroku
    port = int(os.environ.get('PORT', 8888))
    env = os.environ.get('SP_ENV','development')
    debug = env != 'production'
    if debug:
    	app.run(debug=True, port=port, host='0.0.0.0')
    else:
    	app.run(debug=False, port=port)
