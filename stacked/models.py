from google.appengine.api import users
from google.appengine.ext import db
from google.appengine.ext.db import polymodel

class DictModel(db.Model):
    def to_dict(self):
        return dict([(p, unicode(getattr(self, p))) for p in self.properties()])
    @property
    def str_id(self):
        return self.key().id

class PolyDictModel(polymodel.PolyModel):
    def to_dict(self):
        ret = dict([(p, unicode(getattr(self, p))) for p in self.properties()])
        return ret
    @property
    def str_id(self):
        return self.key().id

class StackEdUser(PolyDictModel):
    userid = db.StringProperty()
    nickname = db.StringProperty()
    email = db.StringProperty()
    is_admin = db.BooleanProperty(default=False)

    @property
    def num_starred(self):
    	return self.starred_questions.count

class StackQuestion(DictModel):
	question_id = db.StringProperty()
	created_at = db.DateTimeProperty(auto_now_add=True)
	
class StackEdUser_StackQuestion(DictModel):
	user = db.ReferenceProperty(StackEdUser, collection_name='starred_questions')
	question = db.ReferenceProperty(StackQuestion, collection_name='users')
	created_at = db.DateTimeProperty(auto_now_add=True)

class UserPrefs(db.Model):
    userid = db.StringProperty()
