#!/usr/bin/env python
# 
#   Author: Nirvana Tikku (@ntikku) - http://github.com/nirvanatikku/ga_twitterbot
#
import os
import sys
import webapp2
import logging
import datetime
import urllib2
import httplib2
import json
import random 
import tweepy
from datetime import timedelta
from apiclient.discovery import build
from google.appengine.ext.webapp import template
from google.appengine.ext import db
from google.appengine.ext.webapp.util import run_wsgi_app
from PyCryptoSignedJWT import PyCryptoSignedJwtAssertionCredentials
from stackedbot.models import PendingTweet

logger = logging.getLogger('stack_ed_bot')
dev_env = os.environ['SERVER_SOFTWARE'].startswith('Development')

## note: must have a bot_credentials file in the root/parent directory
try:
    creds = json.loads(open('bot_credentials.json').read())
except:
    print "Need a bot_credentials.json file."
    sys.exit(1)

#
# Google Analytics/API credentials
#
gdata_scopes = creds['scopes']
client_id = creds['client_id']
service_account = creds['service_account']
crypto_key = creds['pem_filename'] 

#
# Twitter OAuth credentials
#
tw_consumer_key = creds['tw_consumer_key']
tw_consumer_secret = creds['tw_consumer_secret']
tw_access_token = creds['tw_access_token']
tw_access_token_secret = creds['tw_access_token_secret']

##
## /Constants
##

logger.info("<<< Initializing Twitter Bot >>>")

##
## Services
##

try:
    logger.debug("service init")

    key = open(crypto_key).read()
    logger.debug(">> loaded key")

    ##
    ## google oauth
    ##
    credentials = PyCryptoSignedJwtAssertionCredentials(
        service_account,
        key, 
        scope=" ".join(gdata_scopes))
    logger.debug(">> built credentials")

    http = httplib2.Http()
    httplib2.debuglevel = True
    http = credentials.authorize(http)
    logger.debug(">> authorized credentials and init'd http obj")

    service = build(serviceName='analytics', version='v3', http=http)
    logger.debug(">> analytics service init'd")

    ##
    ## twitter oauth 
    ##
    auth = tweepy.OAuthHandler(tw_consumer_key, tw_consumer_secret)
    auth.set_access_token(tw_access_token, tw_access_token_secret)
    api = tweepy.API(auth)
    logger.debug(">> twitter/tweepy init'd")

    logger.info("service init'd!")
except Exception:
    logger.debug("Error initializing google analytics and tweepy")
    service = None
    api = None

##
## /Services
##

##
## Utils
##

"""
BotMessage is a template renderer.
This class takes a context and will render a template as defined
in the 'templates' directory. Simply instantiate a new BotMessage 
and invoke the 'render_page' method with the desired template, 
and a context (dictionary).
"""
class BotMessage:

    ROOT = "../templates/"

    def __init__(self):
        self.path = BotMessage.ROOT

    def render_page(self, pagePath, ctx={}):
        return self.render(pagePath,ctx)

    ## pagePath: string, ctx: dict
    def render(self, tmplPath, ctx={}):
        path = os.path.join(os.path.dirname(__file__), self.path + tmplPath)
        return template.render(path, ctx)

"""
This utility initializes the start and end date for the query upon instantiation.
Once instantiated, invoke 'seed' to populate the PendingTweets. 
You can setup your own logic here. In this example, the twitterbot will publish
trending tracks in descending order; in order to achieve this I store a 'rank'.
This assumes that the GA query performs the sort. 
"""
class SeedTweetsUtil:

    # init'd from twitterbot_credentials
    Google_Analytics_ID = creds['ga_account_id']
    
    # query related
    """ trackEvt("Select_Question", self.model.get("title")+"|"+self.model.get("link"), self.model.get("tags").join("|")); """
    Google_Analytics_Max_Results = "50"
    Google_Analytics_Filters = 'ga:eventCategory==Select_Question'
    Google_Analytics_Sort = '-ga:totalEvents'
    Google_Analytics_Dimensions = 'ga:eventAction,ga:eventLabel'
    Google_Analytics_Metrics = 'ga:totalEvents'

    def __init__(self):
        self.start_date = self.get_start_date()
        self.end_date = self.get_end_date()

    """ currently set to: 'yesterday' """
    def get_start_date(self):
        day_before = datetime.datetime.now() - timedelta(days=1)
        return day_before.strftime("%Y-%m-%d")
        
    """ currently set to: 'today' """
    def get_end_date(self):
        return datetime.datetime.now().strftime("%Y-%m-%d")

    def seed(self):
        logger.debug('seeding tweets from date range: %s - %s' % (self.start_date, self.end_date))
        try:
            """ query google analytics """
            api_query = service.data().ga().get(
                ids = SeedTweetsUtil.Google_Analytics_ID,
                start_date = self.start_date,
                end_date = self.end_date,
                metrics = SeedTweetsUtil.Google_Analytics_Metrics,
                dimensions = SeedTweetsUtil.Google_Analytics_Dimensions,
                sort = SeedTweetsUtil.Google_Analytics_Sort,
                filters = SeedTweetsUtil.Google_Analytics_Filters,
                max_results = SeedTweetsUtil.Google_Analytics_Max_Results)
            results = api_query.execute()
            logger.info(" google analytics query results %s " % results )
            self.store_pending_tweets(results)
            return True
        except Exception as e:
            logger.debug(str(e)) 
            return False
        
    """ 
    action= self.model.get("title")+"|"+self.model.get("link")
    label= self.model.get("tags").join("|")
    """
    def store_pending_tweets(self, query_results):
        logger.debug('attempting to store pending tweets')
        if len(query_results.get('rows', [])) > 0:
            db.delete(PendingTweet.all()) # clear all the pending tweets
            logger.debug("cleared all pending tweets")
            pos = 1
            for row in query_results.get('rows'):
                logger.debug( '\t'.join(row) )
                title_and_link = row[0]
                firstPart = title_and_link.index("|") 
                title = title_and_link[0:firstPart]
                link = title_and_link[firstPart+1:]
                tags = row[1]
                view_count = long(row[2])
                pos += self.store_pending_tweet(title, link, tags, view_count, pos)

    """ store a pending tweet to the datastore. these will be retrieved and used in constructing the tweet. """
    def store_pending_tweet(self, title, link, tags, view_count, pos):
        pt = PendingTweet(title=title, link=link, tags=tags, viewCount=view_count, rank=pos)
        pt.put()
        logger.info("Adding a PendingTweet (%s) " % pt)
        return 1


class BaseHandler(webapp2.RequestHandler):

    def __init__(self, request, response):
        super( BaseHandler, self ).__init__(request, response)

    ## build, save and publish the tweet
    def tweet(self, ctx):   
        msg = BotMessage().render_page('status', ctx)
        logger.info("posting tweet %s" % msg)
        if dev_env:
            return (msg, msg)
        else:
            return (api.update_status(msg), msg)

"""
The CronTweetHandler is expected to be tied to the endpoint that publishes
the tweet. This request handler performs a few tasks:
    1. Retrieves the latest tweet, sorted by 'playCount' in this example
    2. If the tweet is considered in the top 10 positions, prefixes with a 'position' char
"""
class CronTweetHandler(BaseHandler):

    """
    Provides some ordering to tweets. For Top 10, prefix the tweet with '1', '2', '3' etc. 
    Minimizes character usage by using unicode values (simply 1 char).
    """
    def get_pos_string(self, pos):
        if pos is None:
            return ''
        if pos > 10:
            return ''
        if pos == 1:
            return u'\u2780'
        elif pos == 2:
            return u'\u2781'
        elif pos == 3:
            return u'\u2782'
        elif pos == 4:
            return u'\u2783'
        elif pos == 5:
            return u'\u2784'
        elif pos == 6:
            return u'\u2785'
        elif pos == 7:
            return u'\u2786'
        elif pos == 8:
            return u'\u2787'
        elif pos == 9:
            return u'\u2788'
        elif pos == 10:
            return u'\u2789'
        else:
            return ''

    def get_pending_tweet(self):
        return db.Query(PendingTweet).order("rank").get()

    """ Handle our get request. We will fetch our pending tweet, and publish it. """
    def get(self):
        pending_tweet = self.get_pending_tweet()
        logger.info("working with %s" % pending_tweet)
        if pending_tweet is not None:
            ctx = {}
            ctx['title'] = pending_tweet.title
            ctx['link'] = pending_tweet.link
            ctx['tags'] = pending_tweet.tags.split("|")
            ctx['view_count'] = pending_tweet.viewCount
            ctx['rank'] = self.get_pos_string(pending_tweet.rank)
            pending_tweet.delete()
            logger.info("tweeting %s" % ctx)
            ret = self.tweet(ctx)
            self.response.write("%s" % ctx)
        else:
            self.response.write("couldn't tweet. seems as though pending_tweet doesn't exist.")

"""
This is our request handler that will seed the datastore with
relevant information from Google Analytics. 
"""
class CronSeedTweetsHandler(BaseHandler):

    def get(self):
        logger.info('request to seed tweets')
        seeder = SeedTweetsUtil()
        seeded = seeder.seed()
        self.response.write("Successfully Seeded PendingTweets" if seeded is True else "Failed to Seed PendingTweets")
        return



app = webapp2.WSGIApplication([
    (r'/cron/seed_tweets', CronSeedTweetsHandler),
    (r'/cron/tweet', CronTweetHandler)
], debug=dev_env)

def main():
    run_wsgi_app(app)

if __name__ == '__main__':
    main()
