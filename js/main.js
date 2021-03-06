require.config({
    baseUrl: "js/",
    paths: {
        "jquery": [
            "libs/jquery.min" // fallback
        ],
        "backbone":             "libs/backbone",
        "underscore":           "libs/underscore", 
        "bootstrap":            "libs/bootstrap.min",
        "less":                 "libs/less.min",
        "moment":               "libs/moment",
        "keymaster":            "libs/keymaster.min",
        "stackAPI":             "stackAPI",
        "stackComponents":      "stackComponents",
        "app":                  "app"
    },
    shim: { 
        'backbone': { 
            deps: ['underscore', 'jquery']
        },
        'bootstrap': {
            deps: ['jquery']
        }
    }
});

/**
    stack-ed.com
 */

require(["stackComponents","app","moment","bootstrap","underscore"], function(components, App){

    var trackEvt = function trackEvt(category, action, label){
        try { 
            _gaq.push(['_trackEvent', category, action, label]);
        } catch (ex){}
    };

    var StackUser = components.StackUser,
        StackUserView = components.StackUserView,
        StackAnswer = components.StackAnswer,
        StackAnswerView = components.StackAnswerView,
        StackAnswers = components.StackAnswers,
        StackQuestion = components.StackQuestion,
        StackQuestions = components.StackQuestions,
        StackQuestionView = components.StackQuestionView,
        StackTag = components.StackTag,
        StackTags = components.StackTags,
        StackTagView = components.StackTagView,
        StackResponse = components.StackResponse,
        StackSite = components.StackSite,
        StackSites = components.StackSites,
        StackSitesView = components.StackSitesView;
    var StackAPI = components.API;

	var StackAPI_Key = "[provide a stack overflow key]";

    var Answerers = {
        init: function init(tag, overwrite){
            return function(res){
                var results = new StackResponse(res);
                if( overwrite || _.isUndefined(App.get("cache").get("answerers")) ) {
                    App.get("cache").set("answerers", results);
                } else {
                    App.get("cache").answerers.get("items").add(results.get("items").models);
                }
                if( results.get("has_more") === true ) { 
                    App.view.$el.find(".js-load-more-answerers").show();
                } else if ( results.get("has_more") === false ) { 
                    App.view.$el.find(".js-load-more-answerers").hide();
                }
                var items = results.get("items");
                items.comparator = function(m1,m2){
                    var c = function(c1,c2){
                        if (c1 < c2) return -1;
                        if (c1 > c2) return +1;
                        return 0;
                    };
                    return _.reduce(["reputation","accept_rate"], function (acc, comp) {
                        return acc !== 0 ? acc : -c(m1.get(comp), m2.get(comp))
                    }, 0);
                };
                App.view.clearAnswerers();
                items.sort();
                var tmpView;
                if(items.models){
                    for(var i=0; i<items.models.length; i++){
                        tmpView = new StackUserView({model: items.models[i]});
                        tmpView.on("select", function(){
                            // StackAPI.questions_by_users(this.model.get("user_id"),{
                            //  key: StackAPI_Key
                            // }).done(initQuestions());
                            this.clearSelectedSiblings();
                            App.router.routeTo("site/"+App.get("site").get("api_site_parameter")+"/tag/"+encodeURIComponent(tag)+"/user/"+this.model.get("user_id")+"/"+this.model.get("display_name"));
                        });
                        App.view.addAnswerer(tmpView.render().el);
                        if( App.get("cache").get("current_user") ){
                            if( App.get("cache").get("current_user") === String(items.models[i].get("user_id")) ) {
                                tmpView.setSelected(true);
                            }
                        }
                    }
                }
                App.view.showAnswerersPanel();
                // console.log(results);
            };
        }
    };

    function initQuestionsWithAnswerers(overwrite){
        return function(res){
            window.scrollTo(0, 0);
            var results = new StackResponse(res);
            var items = results.get("items");
            if (App.get("cache").get("answers") && !overwrite){
                App.get("cache").get("answers").get("items").add(items.models);
            } else if(overwrite){
                App.view.clearQuestions();
                App.get("cache").set("answers", results);
            }  
            var questionIDs = [];
            _.each(items.models,function(m){
                questionIDs.push(m.get("question_id"));
            });
            StackAPI.questions_by_ids(questionIDs.join(";"), {
                key: StackAPI_Key
            }).done(initQuestions);
        };
    }

    function initQuestions(res){

        //
        // TODO: fix this....
        //
        var results = new StackResponse(res);
        //
        // right now assumes initQuestions is called from initQuestionsWithAnswerers
        // do merge of answers<->question; i will refactor this code, but i'm trying to get this out the door..
        var mergeElements = ["answer_id","is_accepted","up_vote_count","down_vote_count","score"];
        var acceptedAnswers = App.get("cache").get("answers").get("items");
        var _a, _q, qid, _answer, _question;
        for(var i=0; i<acceptedAnswers.length; i++){
            qid = acceptedAnswers.models[i].get("question_id");
            _a = acceptedAnswers.where({question_id:qid});
            _q = results.get("items").where({question_id:qid});
            if(_a.length>0 && _q.length>0){
                _answer = _a[0].toJSON();
                _question = _q[0].toJSON();
                for(var key in mergeElements){
                    // console.log(mergeElements[key],_answer[mergeElements[key]]);
                    _q[0].set( mergeElements[key], _answer[mergeElements[key]] );
                }
            }
        }

        App.get("cache").set("questions", results);
        results.get("items").comparator = function(m1,m2){
            var c = function(c1,c2){
                var c1 = typeof c1 === "boolean" ? (c1?1:0) : c1;
                var c2 = typeof c2 === "boolean" ? (c2?1:0) : c2;
                if (c1 < c2) return 1;
                if (c1 > c2) return -1;
                return 0;
            };
            return _.reduce(["is_accepted","view_count","score"], function (acc, comp) {
                var ret = acc === 0 ? -c(m1.get(comp), m2.get(comp)) : acc;
                if(comp === 'score'){
                    ret *= -1;
                }
                return ret;
            }, 0);
        };
        results.get("items").sort();
        // App.view.clearQuestions();
        var tmpView, isFav;
        var items = results.get("items");
        var models = items.models;
        for(var q in models){
            isFav = false; // reset isFav
            // tmpView = new StackUserView({model: items.models[q].get("owner")});
            // $(".js-users").append(tmpView.render().el);
            tmpView = new StackQuestionView({model: models[q]});
            tmpView.on("star", function(m){
                var user = App.get("user");
                if( user ) { 
                    var starredQs = user.get("starred_questions");
                    var qID = this.model.get("question_id");
                    var d = {  question_id: qID  };
                    var self = this;
                    var req = $.ajax({
                        url: "/star_question",
                        type: "post", 
                        data:d
                    }).done(function(res){
                        var fav = res === "favorited";
                        if( res === "unfavorited" ) { 
                            self.setFavorite(false);
                            var newStarredQs = _.without(starredQs, String(qID));
                            user.set("starred_questions", newStarredQs);
                        } else if (res === "favorited") { 
                            self.setFavorite(true);
                            starredQs.push( String(qID) );
                            user.set("starred_questions", starredQs);
                            user.trigger("change:starred_questions");   
                        } else { 
                            // console.log(res);
                        }
                    });
                    trackEvt("Star_Question", qID);
                } else { 
                    // modal alert that user should login
                    trackEvt("Sign_In","Show_Modal");
                    $('#signin').modal({keyboard: false,backdrop:'static'}).show();
                }
            });
            tmpView.on("select",function(m){
                var self = this;
                if( self.hasAnswer && self.hasQuestion ) {
                    self.$el.find(".qa-container").toggle();
                    return;
                }
                var accepted_answer_id = self.model.get("accepted_answer_id");
                if( accepted_answer_id == 0 ) { // type coercion is fine
                    self.addAnswerContent($('<div></div>')[0]);
                    self.showAnswerContent(true);
                    return;
                }
                self.showLoadingGif();
                trackEvt("Select_Question", self.model.get("title")+"|"+self.model.get("link"), self.model.get("tags").join("|"));
                StackAPI.answer(accepted_answer_id, {
                    key: StackAPI_Key
                }).done(function(res){
                    // answer
                    StackAPI.accepted_answer_content({
                        link: self.model.get("link"),
                        accepted_answer_id: accepted_answer_id
                    }).done(function(r){
                        // var ret = r.query.results.div.table.tr[0].td[1].div; // json
                        var content_expr = ".answercell .post-text";
                        var ret = $(r).find("results " + content_expr); // xml
                        if( ret.length === 0){
                            $.ajax({ 
                                url: "/parse_so", 
                                data: { 
                                    url: self.model.get('link'),
                                    parse_id: ("answer-"+accepted_answer_id)
                                }
                            }).done(function(res){
                                (function(){
                                    if( res === '' ) { 
                                        self.addAnswerContent($('<div>No Accepted Answer.</div>')[0]);
                                        self.showAnswerContent(true);
                                        return;
                                    }
                                    var ret = $(res).find(content_expr);
                                    self.addAnswerContent(ret);
                                    self.showAnswerContent(true);
                                })();
                            });
                        } else { 
                            (function(){
                                self.addAnswerContent($("<div></div>").append(ret).html()); // XML -> string -> $.parseHTML
                                self.showAnswerContent(true);
                            })();
                        }
                    });
                    // question
                    StackAPI.accepted_answer_question_content({
                        link: self.model.get("link")
                    }).done(function(r){
                        var content_expr = ".postcell .post-text";
                        var ret = $(r).find("results " + content_expr);
                        if( ret.length === 0 ){
                            $.ajax({ 
                                url: "/parse_so", 
                                data: { 
                                    url: self.model.get('link'),
                                    parse_id: "question",
                                    expr: content_expr
                                }
                            }).done(function(res){
                                (function(){
                                    if( res === '' ) { 
                                        self.addQuestionContent($('<div>Couldn\'t Load Question.</div>')[0]);
                                        self.showQuestionContent(true);
                                        return;
                                    }
                                    var ret = $(res).find(content_expr);
                                    self.addQuestionContent(ret);
                                    self.showQuestionContent(true);
                                })();
                            });
                            
                            return;
                        }
                        (function(){
                            self.addQuestionContent($("<div></div>").append(ret).html());
                            self.showQuestionContent(true);
                        })();
                    });
                });
            });
            if( App.get("user") ) { 
                (function(){
                    var starred_qs = App.get("user").get("starred_questions");
                    var q_id = models[q].get("question_id");
                    if( _.contains(starred_qs, String(q_id)) ){
                        isFav = true;
                    }
                })();
            }
            App.view.addQuestion(tmpView.render(isFav).el);
        }
    };

    var Tags = {
        getCacheItems: function(tag){
            var tags = App.get("cache").get("tags");
            if( tags && tags.get("items").length ) {
                return tags.get("items").where({name: tag});
            }
            return [];
        },
        inCache: function(tag){
            var tagsCache = App.get("cache").get("tags");
            if( tagsCache ) {
                return this.getCacheItems(tag).length > 0;
            }
            return false;
        },
        clearSelections: function(){
            var views = App.view.views.tags;
            if(views && views.length){
                views[0].clearSelectedSiblings();
            }
        },
        init: function init(res){
            var results = new StackResponse(res);
            var cache = App.get("cache");
            if(_.isUndefined(cache.get("tags"))){
                cache.set("tags",results);
            } else { 
                var items = results.get("items");
                var cacheItems = cache.get("tags").get("items");
                if( items && items.length ){
                    for(var k=0; k<items.length; k++){
                        if( cacheItems.where({ name: items.models[k].get('name') }).length > 0 ){
                            items.remove(items.models[k]);
                        }
                    }
                    cacheItems.add(items.models);
                } else { 
                    return;
                }
            }
            // results.get("items").comparator = function
            var items = results.get("items");
            var tmpView;
            for(var t in items.models){
                tmpView = new StackTagView({model: items.models[t]});
                tmpView.on("select", function(){
                    this.clearSelectedSiblings();
                    App.router.routeTo("site/"+App.get("site").get("api_site_parameter")+"/tag/" + encodeURIComponent(this.model.get("name")));
                });
                App.view.addTag(tmpView);
                // expects $el, must be done after render
                if( cache.get("current_tag") ){
                    if( cache.get("current_tag") === items.models[t].get("name") ) {
                        tmpView.clearSelectedSiblings();
                        tmpView.setSelected(true);
                    }
                }
            }
        },
        search: function search(text, filter){
            if( !Tags.inCache(text) ) { 
                trackEvt("Search_Tags",text);
                var req = StackAPI.search_tags(text, { key: StackAPI_Key });
                req.done(Tags.init)
                if( filter ) { 
                    req.then(function(){
                        App.view.filterTags(text);
                    });
                }
                return req;
            } else { 
                return this.getCacheItems(text);
            }
        }
    };

    // used in templates
    window.Format = {
        comma: function(num){
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        },
        epoch: function(d){
            return moment(d*1000).format('MMMM Do YYYY, h:mm:ss a');
        }
    };
    window.App = App; // global ref to the app

    /*
        Stack-Ed's Router can be used in two ways. The first involves routing the 
        window location href to the desired route. The second involves invoking the
        methods on the router, directly. 
            + Sites are only loaded once and cached
            + If tags, answerers or questions are requested, the following checks are performed
                - if sites are not initialized, every method will attach a done callback
                    to the deferred request
                - if tags are required and aren't cached, fetch and cache them. create a deferred request 
                    and let other methods resolve their needs as appropriate
                - if sites are init'd, and tags exist, the methods perform their operations 
     */
    var Router = Backbone.Router.extend({
        routes: { 
            "tag/:tag/user/:user_id/:display_name":"_qTagUserRoute", // legacy
            "tag/:tag":"_tagRoute", // legacy
            "site/:site/tag/:tag/user/:user_id/:display_name": "qTagUserRoute",
            "site/:site/tag/:tag": "tagRoute",
            "site/:site": "siteRoute",
            "my-starred-questions": "starredQuestions",
            "random": "randomQuestions",
            "about": "aboutStackEd",
            "*actions": "defaultRoute"
        },
        initialize: function(incoming){
            _.bindAll(this, 'routeTo', 'defaultRoute', 'tagsRoute', 'tagRoute', 'qTagUserRoute', 'starredQuestions','randomQuestions','aboutStackEd');
            if('app' in incoming){
                this.app = incoming.app;
            }
            Backbone.history.start(); // kick things off. {pushState: true}
        },
        requesting_sites:false,
        requesting_tags:false,
        initSites: function(){
            if(this.requesting_sites){
                return this.requesting_sites;
            }
            var self = this;
            return this.requesting_sites = StackAPI.sites({key:StackAPI_Key,pagesize:200}).then(function(res){
                var _items = res['items'], items = [];
                for(var i=0; i<_items.length; i++){
                    if(_items[i].name.indexOf('Meta')===-1){
                        items.push(_items[i]);
                    }
                }
                App.sites = new StackSites(items);
                App.view.sites = new StackSitesView({
                    el: $("#js-sites-toggle")[0],
                    collection: App.sites
                });
                App.view.sites.render();
                App.view.sites.on("pick_site",function(site){
                    trackEvt("Site","Pick_Site",site);
                    App.router.routeTo("site/"+site.get("api_site_parameter"));
                });
            }).done(function(){
                (function(){self.requesting_sites = false;})();
            });
        },
        routeTo: function(baseUrl, qryParams){
            if( baseUrl === "home" ) baseUrl = "";
            window.location.hash = baseUrl + (qryParams||"");
            // eventually replace with this.route
        },
        _qTagUserRoute: function(tag,user_id,display_name){
            return this.qTagUserRoute('stackoverflow',tag,user_id,display_name);
        },
        qTagUserRoute: function(site, tag, user_id, display_name){
            var dReq = null;
            if(_.isUndefined(this.app.get("cache").get("tags"))){
                dReq = this.tagRoute(site, tag, !_.isUndefined(user_id));
            }
            tag = decodeURIComponent(tag);
            this.app.get("cache").set("current_tag", tag);
            this.app.get("cache").set("current_user", user_id);
            this.app.view.setSearchFilter(tag, display_name);
            var self = this;
            if(dReq != null){
                dReq.done(function(){
                    StackAPI.topanswers_by_users(user_id,encodeURIComponent(tag),{
                        key: StackAPI_Key
                    }).then(initQuestionsWithAnswerers(true)).done(function(){
                        (function(){
                            self.app.view.showAnswerersPanel();
                            self.app.view.showQuestionsPanel();
                        })();
                    });
                    trackEvt("Top_Answers_By_Users","Request",tag+":"+user_id);
                });
                return dReq;
            }
            StackAPI.topanswers_by_users(user_id,encodeURIComponent(tag),{
                key: StackAPI_Key
            }).then(initQuestionsWithAnswerers(true)).done(function(){
                (function(){
                    self.app.view.showAnswerersPanel();
                    self.app.view.showQuestionsPanel();
                })();
            });
            trackEvt("Top_Answers_By_Users","Request",tag+":"+user_id);
        },
        siteRoute: function(site){
            if(App.sites == null){
                var self = this;
                return this.initSites().done(function(){
                    (function(){
                        self.siteRoute(site);
                    })();
                });
            }
            this.app.set("site", this.app.sites.where({api_site_parameter:decodeURIComponent(site || StackAPI.DEFAULT_SITE)})[0]);
            trackEvt("Site", "Route", site || StackAPI.DEFAULT_SITE);
            this.tagsRoute(site, true);
        },
        tagsRoute: function(site, is_fresh_set){
            if(!App.get("site")){
                var self = this;
                return this.siteRoute(site).done(function(){
                    (function(){
                        self.tagsRoute(is_fresh_set);
                    })();
                });
            }
            if(this.requesting_tags) return this.requesting_tags;
            // make sure we dont have a pending request
            this.app.view.removeIntroMessage();
            this.app.view.initSocialMedia();
            this.app.view.showNavbar();
            this.app.view.showTagsPanel();
            if(is_fresh_set === true){
                this.app.view.clearTags();
                this.app.view.hideAnswerersPanel();
                this.app.view.hideQuestionsPanel();
            }
            trackEvt("Tags","Request");
            var self = this;
            return this.requesting_tags = StackAPI.tags({ key: StackAPI_Key }).then(Tags.init).done(function(){
                (function(){
                    self.requesting_tags = false;
                })();
            });
        },
        _tagRoute: function(tag){
            return this.tagRoute('stackoverflow',tag);
        },
        tagRoute: function(site,tag,has_current_user){
            tag = decodeURIComponent(tag);
            var dReq = null; // TODO: implement deferreds across the board + with 'site' param
            if(_.isUndefined(this.app.get("cache").get("tags"))){
                dReq = this.tagsRoute(site);
                var self = this;
                return dReq.then(function(){
                    Tags.search(tag);
                }).done(function(){
                    (function(){
                        self.tagRoute(site,tag,has_current_user);
                    })();
                });
            } else { 
                var tags = Tags.search(tag);
                if( !_.isUndefined(tags) && _.isArray(tags) && tags.length ) {
                    tags[0].trigger("select");
                } else { 
                    Tags.clearSelections();
                }
            }
            this.app.get("cache").set("current_tag",tag);
            this.app.view.setSearchFilter(tag);
            if(has_current_user !== true){
                this.app.get("cache").unset("current_user");
                this.app.view.hideQuestionsPanel();
            }
            trackEvt("Top_Answerers_By_Tag","Request",tag);
            return StackAPI.topanswerers_by_tag(tag, {
                key: StackAPI_Key
            }).done(Answerers.init(tag,true));
        },
        starredQuestions: function(){
            if(_.isUndefined(this.app.get("cache").get("tags"))){
                this.tagsRoute(); // TODo: fix this
            }
            this.app.view.showQuestionsPanel();
            this.app.view.setSearchFilter('my starred questions');
            var user = this.app.get("user");
            if( user ) { 
                var ids = user.get("starred_questions");
                if( ids.length ) { 
                    StackAPI.questions_by_ids(ids.join(";"), {
                        key: StackAPI_Key
                    }).done(initQuestionsWithAnswerers(true));
                    trackEvt("Questions_By_Ids","Starred_Questions");
                }
            }
        },
        randomQuestions: function(){
            StackAPI
                .questions({key: StackAPI_Key})
                .done(initQuestions);
        },
        aboutStackEd: function(){
            trackEvt("About","Overlay");
        },
        defaultRoute: function(target){
            // this.siteRoute();
            if(this.app.get("user")){
                this.siteRoute();
                // this.tagsRoute(); //after sites load
            }
        }
    });

    // A user very simply has a nickname and their starred questions.
    var StackEdUser = Backbone.Model.extend({
        defaults:{
            nickname: "",
            starred_questions: []
        }
    });

    $(document).ready(function(){

        if(window.User){
            var stackEdUser = new StackEdUser(window.User);
            App.set("user", stackEdUser);
            stackEdUser.on("change:starred_questions",function(){
                // could setup a view for the model... but.. it's just one field.
                App.view.$userNumStarred.html(this.get("starred_questions").length);
            });
        }

        App.sites = null;

        App.on('change:site',function(){
            $("#js-current-site").html(this.currentSiteIconHTML());
            $(".js-site-name").text(this.get("site").get("name"));
            StackAPI.DEFAULT_SITE = this.get("site").get("api_site_parameter");
            this.get("cache").unset("tags");
        });

        App.router = new Router({ app: App });
        App.router.initSites().then(function(){
            if(!App.get("cache").get("tags")){
                var m = App.sites.models;
                function nameTimer(){
                    setTimeout(function(){
                        var name = m[parseInt(Math.random()*m.length,10)].get('name');
                        $("#js-site-name")
                            .animate({opacity:0.5},400,function(){
                                $("#js-site-name").text( name );
                            })
                            .animate({opacity:1},400,function(){
                                if(!App.get("cache").get("tags")){
                                    nameTimer();
                                }
                            });
                    },1000);
                }
                nameTimer();
            }
        });
        
        //
        // everything in here describes how the ui behaves. 
        // below are additional event handlers that exist in the HTML
        // i'm also adding analytics as part of the events for user behavior tracking.
        //
        App.view.$el.find(".start").on("click",function(){
            $(".intro-message").animate({
                opacity:0
            },1200,function(){
                $(this).remove();
                App.view.initSocialMedia();
                var dR = App.router.siteRoute();
                if(dR){
                    dR.done(function(){App.router.tagsRoute();});
                    return;
                }
                App.router.tagsRoute();
            });
            trackEvt("Begin","Click");
        });
        App.view.$el.find(".js-load-more-tags").on("click",function(evt){
            var tags = App.get("cache").get("tags").get("items");
            var pg = parseInt(tags.length / 40, 10) + 1; // apriori knowledge tags pagesize=40
            StackAPI.tags({ key: StackAPI_Key, page: pg }).done(Tags.init);
            trackEvt("Tags","Request_More",pg);
        });
        App.view.$el.find(".js-load-more-answerers").on("click",function(evt){
            var answerers = App.get("cache").get("answerers").get("items");
            var pg = parseInt(answerers.length / 30, 10) + 1; // answerers pagesize=30
            StackAPI.topanswerers_by_tag(App.get("cache").get("current_tag"), {
                key: StackAPI_Key,
                page: pg
            }).done(Answerers.init(App.get("cache").get("current_tag"),false));
            trackEvt("Top_Answerers_By_Tag","Request_More",pg);
        });
        App.view.$el.find(".js-load-more-questions").on("click",function(evt){
            // Need to figure out what's happening with pagination here... 
            var answers = App.get("cache").get("questions").get("items");
            var pg = parseInt(answers.length / 20, 10) + 1; // answers pgsize = 20
            StackAPI.topanswers_by_users(App.get("cache").get("current_user"),encodeURIComponent(App.get("cache").get("current_tag")),{
                key: StackAPI_Key,
                page: pg
            }).done(initQuestionsWithAnswerers(false));
            trackEvt("Top_Answerers_By_Users","Request_More",pg);
        });
        App.view.$el.find(".js-search-toggle-button").on("click", function(evt){
            $(".js-search-form").toggleClass("open");
        });
        App.view.$el.find("[name='js-search-tags-query']").on("keyup",function(evt){
            var $this = $(this), text = $this.val();
            switch (evt.which){
                case 13:
                case 14:
                    Tags.search(text, true);
                    break;
                default:
                    App.view.filterTags(text);
            };
        });
        App.view.$el.find(".js-search-tags-query-button").on("click",function(evt){
            var $this = $(this);
            var $input = App.view.$el.find("[name='js-search-tags-query']");
            var text = $input.val();
            if( text !== '' ) { 
                var srch = Tags.search(text, true);
                if(srch){
                    $this.attr("disabled", true);
                    srch.then(function(){
                        $this.attr("disabled", false);
                    });
                }
            }
        });

    });

});