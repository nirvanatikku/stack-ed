define(['backbone'],function(){

	var App = Backbone.Model.extend({
		defaults: { 
			user: undefined,
			cache: { }
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
		setSearchFilter: function setSearchFilter(tag, user){
			var tmpl = _.template("&ndash; <div class='label'><%= lbl %></div>");
			var html = tmpl({lbl:tag});
			if( user ) { 
				html += " " + tmpl({lbl:user});
			}
			this.$filters.html(html);
		},
		initialize:function(){
			_.bindAll(this,'domReady');
			// 
			$(document).ready(this.domReady);
		},
		addTag: function(tagEl){
			this.$tags.append(tagEl);
		},
		addQuestion: function(qEl){
			this.$questions.append(qEl);
		},
		clearQuestions: function(){
			this.$questions.html("");
		},
		addAnswerer: function(aEl){
			this.$answerers.append(aEl);
		},
		clearAnswerers: function(){
			this.$answerers.html("");
		},
		showAnswerersPanel: function(){
			this.$answerersContainer.show();
		},
		showQuestionsPanel: function(){
			this.$questionsContainer.show();
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