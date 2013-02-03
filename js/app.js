define(['backbone'],function(){

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
            user: undefined,
            cache: new AppCache(),
            view: undefined
        },
        initialize:function(incoming){
            this.view = new AppView({
                el: document.body,
                model: this
            });
        }
    });

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
        addQuestion: function(qEl){
            this.$questions.append(qEl);
        },
        clearQuestions: function(){
            this.$questions.html("");
            this.views.questions = [];
        },
        addAnswerer: function(aEl){
            this.$answerers.append(aEl);
        },
        clearAnswerers: function(){
            this.$answerers.html("");
            this.views.answerers = [];
        },
        showAnswerersPanel: function(){
            this.$answerersContainer.show();
        },
        hideAnswerersPanel: function(){
            this.$answerersContainer.hide();
        },
        showQuestionsPanel: function(){
            this.$questionsContainer.show();
        },
        hideQuestionsPanel: function(){
            this.$questionsContainer.hide();
        },
        showTagsPanel: function(){
            this.$tagsContainer.show();
        },
        removeIntroMessage: function(){
            this.$el.find(".intro-message").remove();
        },
        showNavbar:function(){
            this.$navbar.css("opacity","1");
        },
        domReady: function(){
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