#!/usr/bin/env python
# 
#   Author: Nirvana Tikku (@ntikku)
#   MIT License
#
import os
import webapp2
import logging
import urllib2
import json
from webapp2_extras import sessions
from google.appengine.ext.webapp import template
from google.appengine.api import users
from google.appengine.ext import db
from stacked.models import *
from google.appengine.ext.webapp.util import run_wsgi_app

dev_env = os.environ['SERVER_SOFTWARE'].startswith('Development')

##
##
## Utils
##
##
class Layout:

    ROOT = "templates/"

    def __init__(self):
        self.layoutPath = "layout.html"
        self.layoutContext = {}

    def getLayoutPath(self):
        return self.layoutPath

    def getLayoutContext(self):
        return self.layoutContext

    def render_page(self, pagePath, ctx={}):
        self.layoutContext['page'] = self.render(pagePath, ctx)
        return self.render(self.getLayoutPath() , dict(self.getLayoutContext(),**ctx) ) 

    ## pagePath: string, ctx: dict
    def render(self, tmplPath, ctx={}):
        path = os.path.join(os.path.dirname(__file__), Layout.ROOT + tmplPath)
        return template.render(path, ctx)


##
##
## Website Request Handlers
##
##
class BaseHandler(webapp2.RequestHandler):

    def __init__(self, request, response):
        super( BaseHandler, self ).__init__(request, response)

    def dispatch(self):
        self.session_store = sessions.get_store(request=self.request)
        try:
            webapp2.RequestHandler.dispatch(self)
        finally:
            self.session_store.save_sessions(self.response)

    @webapp2.cached_property
    def session(self):
        return self.session_store.get_session(backend='datastore')

    def end_session(self):
        ses = self.session_store

    def init_user(self, user):
        userid = user.user_id()
        q = db.Query(StackEdUser)
        q.filter("userid = ", userid)
        ret = q.get()
        if ret is None:
            new_user = StackEdUser(
                nickname=user.nickname(),
                email=user.email(),
                userid=user.user_id())
            new_user.put()
            # logging.info("Created new Stack-Ed User %s" % user.nickname())
            ret = new_user
        self.session['user'] = ret
        return ret

    def getUser(self):
        if self.session is not None:
            if 'user' in self.session:
                if users.get_current_user() is None:
                    self.session['user'] = None
                else:
                    return self.session['user']
        return None

class HomeHandler(BaseHandler):

    def get(self):
        ctx = {}
        stack_ed_user = self.getUser()
        if stack_ed_user is None:
            user =  users.get_current_user()
            if user is None:
                ctx['user'] = None
                ctx['login_url'] = users.create_login_url(federated_identity='https://www.google.com/accounts/o8/id')
            else:
                stack_ed_user = self.init_user(user)
                ctx['user'] = stack_ed_user
                ctx['logout_url'] = users.create_logout_url('/')
        else:
            ctx['user'] = stack_ed_user
            ctx['logout_url'] = users.create_logout_url('/')
        self.response.out.write( Layout().render_page('home.html', ctx) )

class StarQuestionHandler(BaseHandler):

    FAV_RESPONSE = "favorited"
    UNFAV_RESPONSE = "unfavorited"

    def post(self):
        ctx = {}
        stack_ed_user = self.getUser();
        # stack_ed_user <-> stackeduser_stackquestion <-> stack_question
        if stack_ed_user is not None:
            stackQuestionQ = db.Query(StackQuestion)
            stackQuestionQ.filter("question_id = ", self.request.get('question_id'))
            stack_question = stackQuestionQ.get()
            if stack_question is None:
                stack_question = StackQuestion(question_id=str(self.request.get('question_id')))
                stack_question.put()
                user_question = StackEdUser_StackQuestion(user=stack_ed_user,
                    question=stack_question)
                user_question.put()
                self.response.write(StarQuestionHandler.FAV_RESPONSE)
            else:
                user_question_query = db.Query(StackEdUser_StackQuestion)
                user_question_query.filter("user = ", stack_ed_user)
                user_question_query.filter("question = ", stack_question)
                user_question = user_question_query.get()
                if user_question is None:
                    user_question = StackEdUser_StackQuestion(user=stack_ed_user, 
                        question=stack_question)
                    user_question.put()
                    self.response.write(StarQuestionHandler.FAV_RESPONSE)
                else:
                    user_question.delete()
                    self.response.write(StarQuestionHandler.UNFAV_RESPONSE)


config = {}
config['webapp2_extras.sessions'] = {
    'secret_key': '',
    'cookie_name': 'stack-ed'
}

app = webapp2.WSGIApplication([
    (r'/', HomeHandler),
    (r'/star_question', StarQuestionHandler)
], debug=dev_env, config=config)

def main():
    run_wsgi_app(app)

if __name__ == '__main__':
    main()
