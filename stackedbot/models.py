from google.appengine.ext import db

class PendingTweet(db.Model):
    title = db.StringProperty()
    link = db.StringProperty()
    tags = db.StringProperty()
    viewCount = db.IntegerProperty()
    rank = db.IntegerProperty()
    seeded = db.DateTimeProperty(auto_now=True)