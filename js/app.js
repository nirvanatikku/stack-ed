define(['backbone'],function(){

    "use strict";
    var AppCache = Backbone.Model.extend({
        defaults:{ 
            questions: undefined,
            tags: undefined,
            answerers: undefined,
            answers: undefined,
            current_tag: undefined,
            current_user: undefined // this is the current user being searched
        }
    });

    var App = Backbone.Model.extend({
        defaults: { 
            site: undefined,
            user: undefined,
            cache: new AppCache(),
            view: undefined
        },
        currentSiteIconHTML: function(){
            return "<img class='ui-site-icon' src='"+this.get("site").getIconURL()+"'/>";
        },
        initialize:function(incoming){
            _.bindAll(this, 'currentSiteIconHTML');
            this.view = new AppView({
                el: document.body,
                model: this
            });
        }
    });

    var social_media_inited = false;

    var AppView = Backbone.View.extend({
        $filters: null,
        $tags: null,
        views: {
            questions: [],
            tags: [],
            answerers: []
        },
        setSearchFilter: function setSearchFilter(tag, user){
            var tmpl = _.template("&ndash; <div class='label'><%= lbl %></div>");
            var html = tmpl({lbl:tag});
            if( user ) { 
                html += " " + tmpl({lbl:user});
            }
            this.$filters.html(html);
        },
        initialize:function(){
            _.bindAll(this,'domReady','filterTags');
            $(document).ready(this.domReady);
            if(this.model){
                // this.model.get("cache").on("change:current_tag",);
            }
        },
        addTag: function(tagView){
            var prevCount = -1, count = -1;
            // this should really be sorted; this will cause issues when adding custom sorting. ideally access collection?
            var sortedTagViews = _.sortBy(this.views.tags, function(tagview){
                return -tagview.model.get("count");
            });
            var $target = null, prevCount = -1;
            var tvCount = tagView.model.get("count"), tv, count;
            for(var i=0; i<sortedTagViews.length; i++){  // n isn't large.. assumes sorted desc count
                tv = sortedTagViews[i];
                count = tv.model.get("count");
                if( count < prevCount && tvCount > count ) { 
                    break;
                } else { 
                    prevCount = count;
                    $target = tv.$el;
                }
            }
            this.views.tags.push(tagView);
            if( $target === null ) { 
                this.$tags.append(tagView.render().el);
            } else { 
                $target.after(tagView.render().el);
            }
        },
        clearTags: function(){
            var tagViews = this.views.tags;
            this.views.tags = [];
            for(var tv in tagViews){
                tagViews[tv].$el.remove();
            }
        },
        filterTags: function(srch){
            var tagViews = this.views.tags;
            var tagView, name;
            for(var i=0; i<tagViews.length; i++){
                tagView = tagViews[i];
                name = tagView.model.get("name");
                if(name.toLowerCase().indexOf(srch.toLowerCase())>-1){ // strict. will want to normalize this.
                    tagView.trigger("showTag");
                } else { 
                    tagView.trigger("hideTag");
                }
            }
        },
        addQuestion: function addQuestion(qEl){
            this.$questions.append(qEl);
        },
        clearQuestions: function clearQuestions(){
            this.$questions.html("");
            this.views.questions = [];
        },
        addAnswerer: function addAnswerer(aEl){
            this.$answerers.append(aEl);
        },
        clearAnswerers: function clearAnswerers(){
            this.$answerers.html("");
            this.views.answerers = [];
        },
        showAnswerersPanel: function showAnswerersPanel(){
            this.$answerersContainer.show();
        },
        hideAnswerersPanel: function hideAnswerersPanel(){
            this.$answerersContainer.hide();
        },
        showQuestionsPanel: function showQuestionsPanel(){
            this.$questionsContainer.show();
        },
        hideQuestionsPanel: function hideQuestionsPanel(){
            this.$questionsContainer.hide();
        },
        showTagsPanel: function showTagsPanel(){
            this.$tagsContainer.show();
        },
        removeIntroMessage: function removeIntroMessage(){
            this.$el.find(".intro-message").remove();
        },
        showNavbar:function showNavbar(){
            this.$navbar.css("opacity","1");
        },
        initSocialMedia: function initSocialMedia(){
            if(!social_media_inited){
                social_media_inited = true;
                (function(d,s,id){
                    var js,fjs=d.getElementsByTagName(s)[0];
                    if(!d.getElementById(id)){
                        js=d.createElement(s);
                        js.id=id;
                        js.src="//platform.twitter.com/widgets.js";
                        fjs.parentNode.insertBefore(js,fjs);
                    }
                })(document,"script","twitter-wjs");
                (function() {
                    var po = document.createElement('script'); po.type = 'text/javascript'; po.async = true;
                    po.src = 'https://apis.google.com/js/plusone.js';
                    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(po, s);
                })();
            }
        },
        domReady: function domReady(){
            this.$filters = this.$el.find(".js-filter-criteria");
            this.$tags = this.$el.find(".js-tags");
            this.$questions = this.$el.find(".js-questions");
            this.$answerers = this.$el.find(".js-top-answerers");
            this.$answerersContainer = this.$el.find(".js-answerers-container");
            this.$questionsContainer = this.$el.find(".js-questions-container");
            this.$tagsContainer = this.$el.find(".js-tags-container");
            this.$navbar = this.$el.find(".js-navbar");
            this.$userNumStarred = this.$el.find(".js-stacked-user-num-starred");
            return this;
        }
    });

    return new App();

});