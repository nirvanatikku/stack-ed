define(['backbone', 'stackAPI', 'text!templates/user_view.html','text!templates/question_view.html','text!templates/tag_view.html'],
    function(_backbone_, StackAPI, userViewHTML, questionViewHTML,tagViewHTML){

    /**
        All the StackOverflow integration into the site
    */
    var StackUser = Backbone.Model.extend({
        defaults: {
            "user_id": 0,
            "display_name": "",
            "reputation": 0,
            "user_type": "",
            "profile_image": "",
            "link": "",
            "score": "", // artificially added
            "accept_rate": 0
        },
        initialize:function(){
        }
    });

    var StackUsers = Backbone.Collection.extend({
        model: StackUser
    });

    var StackUserView = Backbone.View.extend({ 
        tagName: "div",
        className: "ui-user",
        template: _.template(userViewHTML),
        initialize:function(){

        },
        events: {
            "click": function(evt){
                this.trigger("select", this.model);
                this.setSelected(true);
            }
        },
        setSelected: function(sel){
            if( sel ) { 
                if( !this.$el.hasClass("selected") ){ 
                    this.$el.addClass("selected");
                }
            } else { 
                this.$el.removeClass("selected");
            }
        },
        clearSelectedSiblings: function(){
            this.$el.siblings(".selected").removeClass("selected");
        },
        render: function(){
            if( this.model ) { 
                this.$el.html( this.template( this.model.toJSON() ) );
            }
            return this;
        }
    });

    var StackQuestion = Backbone.Model.extend({
        defaults:{
            "question_id": 0,
            "last_edit_date": 0,
            "creation_date": 0,
            "last_activity_date": 0,
            "score": 0,
            "answer_count": 0,
            "accepted_answer_id": 0,
            "protected_date": 0,
            "title": "",
            "tags": [],
            "view_count": 0,
            "owner": StackUser,
            "link": "",
            "is_answered": false
        },
        initialize: function(response){
            if('owner' in response){
                this.set("owner", new StackUser(response['owner']));
            }
            return response;
        }

    });

    var StackQuestions = Backbone.Collection.extend({
        model: StackQuestion
    });

    var StackQuestionView = Backbone.View.extend({
        tagName: "div",
        className: "ui-question",
        hasQuestion: false,
        hasAnswer: false,
        template: _.template(questionViewHTML),
        initialize:function(){
            _.bindAll(this, 'addAnswerContent');

        },
        events: { 
            "click .title":function(evt){
                var $tgt = $(evt.target);
                if($tgt.is(".starred") || $tgt.parents(".starred").length){
                    this.trigger('star', this.model);
                } else { 
                    this.trigger("select",this.model);
                }
            }
        },
        setFavorite: function(isFav){
            if( isFav ) { 
                if( !this.$el.hasClass("ui-starred") ) {
                    this.$el.addClass("ui-starred");
                } 
            } else { 
                this.$el.removeClass("ui-starred");
            }
        },
        addQuestionContent: function(question){
            this.hasQuestion = true;
            var $question = this.$el.find(".question");
            $question.html(question);
            this.$el.addClass("question-loaded");
        },
        showQuestionContent: function(show){
            var $question = this.$el.find(".question");
            if(show || (typeof show === 'undefined' && !$question.is(":visible"))){
                $question.show();
            } else { 
                $question.hide();
            }
            if( this.hasQuestion && !this.$el.find(".qa-container").is(":visible") ) { 
                this.$el.find(".qa-container").show();
            }
        },
        addAnswerContent: function(answer){
            this.hasAnswer = true;
            var $answer = this.$el.find(".answer");
            $answer.html(answer);
            this.$el.addClass("answer-loaded");
        },
        showAnswerContent: function(show){
            var $answer = this.$el.find(".answer");
            if(show || (typeof show === 'undefined' && !$answer.is(":visible"))){
                $answer.show();
            } else { 
                $answer.hide();
            }
            if( this.hasQuestion && !this.$el.find(".qa-container").is(":visible") ) { 
                this.$el.find(".qa-container").show();
            }
        },
        showLoadingGif: function(){
            this.$el.find(".qa-container").show();
            this.$el.find(".question, .answer").html("<img src='/img/spinner.gif'>");
        },
        render: function(isFavorite){ 
            if( this.model ){
                var j = this.model.toJSON();
                this.$el.html( this.template(j) );
                this.setFavorite(isFavorite);
            }
            return this;
        }
    });

    var StackTag = Backbone.Model.extend({
        defaults: {
            "name": "",
            "count": 0,
            "is_required": false,
            "is_moderator_only": false,
            "has_synonyms": false
        }
    });

    var StackTags = Backbone.Collection.extend({
        model: StackTag
    });

    var StackTagView = Backbone.View.extend({
        tagName: "div",
        className: "ui-tag",
        template: _.template(tagViewHTML),
        initialize:function(){
            _.bindAll(this,'setSelected');
        },
        events:{
            "click .tag-selection":function(evt){
                this.trigger("select", this.model);
                this.setSelected(true);
            }
        },
        setSelected:function(sel){
            if( sel ) { //&& !this.$el.find(".tag-selection").is(":checked") 
                this.$el.find(".tag-selection").attr("checked",true);
                this.$el.addClass("selected");
            } else if ( !sel ) { 
                this.$el.find(".tag-selection").attr("checked",false);
                this.$el.removeClass("selected");
            }
        },
        clearSelectedSiblings: function(){
            this.$el.siblings().find(":checkbox").attr("checked",false);
            this.$el.siblings(".selected").removeClass("selected");
        },
        render:function(){
            this.$el.html( this.template(this.model.toJSON()) );
            return this;
        }
    });

    var StackAnswer = Backbone.Model.extend({
        defaults: {
            "answer_id": 0,
            "is_accepted": false,
            "question_id": 0,
            "owner": StackUser,
            "creation_date": 0,
            "last_edit_date": 0,
            "last_activity_date": 0,
            "up_vote_count": 0,
            "down_vote_count": 0,
            "score": 0,
            "title": "",
            "link": ""
        },
        initialize: function(response){
            if(typeof response !== 'undefined' && 'owner' in response) { 
                this.set("owner", new StackUser(response['owner']));
            }
            if( ('is_accepted' in response ) && !('is_answered' in response) ) { 
                this.set("is_answered", response['is_accepted']);
            }
            return response;
        }
    });

    var StackAnswers = Backbone.Collection.extend({
        model: StackAnswer
    });

    var StackResponse = Backbone.Model.extend({
        defaults: {
            "quota_max": 0,
            "quota_remaining": 0,
            "has_more": false,
            "items": []
        },
        initialize: function(response){
            if( typeof response !== 'undefined' ) { 
                if('items' in response){
                    if ('answer_id' in response['items'][0]){
                        this.set("items", new StackAnswers(response['items']));
                    } else if ('question_id' in response['items'][0] ) {
                        this.set("items", new StackQuestions(response['items']));
                    } else if ('has_synonyms' in response['items'][0] ) { 
                        this.set("items", new StackTags(response['items']));
                    } else if ('user' in response['items'][0]) { 
                        // need to pre-process to get score
                        var users = [], o = {};
                        var items = response['items'];
                        for(var i=0; i<items.length; i++){
                            o = items[i];
                            users.push(_.extend({},o.user,{score: o.score}));
                        }
                        this.set("items", new StackUsers(users));
                    }
                }
            }
        }
    });

    return { 
        API: StackAPI,
        StackUser: StackUser,
        StackUsers: StackUsers,
        StackUserView: StackUserView,
        StackAnswer: StackAnswer,
        StackAnswers: StackAnswers,
        StackQuestion: StackQuestion,
        StackQuestions: StackQuestions,
        StackQuestionView: StackQuestionView,
        StackTag: StackTag,
        StackTags: StackTags,
        StackTagView: StackTagView,
        StackResponse: StackResponse
    };

});
