define(['jquery','underscore'], function(){

    var BASE_URL = "https://api.stackexchange.com/2.1/"; // v1.1: "http://api.stackoverflow.com/1.1/";
    var YQL_BASE_URL = "http://query.yahooapis.com/v1/public/yql?q=";
    var ACCEPTED_ANSWER_YQL_TMPL = "select * from html where url='<%=link%>' and xpath='//div[@id=\"answer-<%=accepted_answer_id%>\"]'"
    var ACCEPTED_QUESTION_YQL_TMPL = "select * from html where url='<%=link%>' and xpath='//div[@id=\"question\"]'"

    var question_search_defaults = {
        "order": "desc",
        "page": "1",
        "pagesize": "20",
        "sort": "votes"
    };

    return {
        DEFAULT_SITE: 'stackoverflow',
        __buildURL: function buildURL(type, params){
            if( (type !== 'sites') && (!params || !('key' in params)) ) { 
                throw "NEED A STACKEXCHANGE KEY";
            }
            if( (type !== 'sites') && !('site' in params) ) { 
                params['site'] = this.DEFAULT_SITE;
            }
            params = _.extend({}, params, {key: params['key']} )
            var qp = [];
            for(var p in params){
                qp.push(p + "=" + encodeURIComponent(params[p]));
            }
            return BASE_URL + type + "?" + qp.join("&");
        },
        "__request__": function(url){
            return $.ajax({
                url: url,
                type: "GET",
                dataType: "jsonp",
                success: function(response){
                    // console.log(response);
                }
            });
        },
        "__request_xml__": function(url){
            return $.ajax({
                url: url,
                type: "GET",
                dataType: "xml",
                success: function(response){
                    // console.log(response);
                }
            });
        },
        // use YQL
        "accepted_answer_content": function(incoming){
            var url = YQL_BASE_URL + encodeURIComponent(_.template(ACCEPTED_ANSWER_YQL_TMPL,{
                link: incoming.link,
                accepted_answer_id: incoming.accepted_answer_id
            }));
            url += "&format=xml";
            return this.__request_xml__(url);
        },
        // use YQL
        "accepted_answer_question_content": function(incoming){
            var url = YQL_BASE_URL + encodeURIComponent(_.template(ACCEPTED_QUESTION_YQL_TMPL,{
                link: incoming.link
            }));
            url += "&format=xml";
            return this.__request_xml__(url);
        },
        "topaskers_by_tag": function(tag, params){
            // /2.1/tags/java/top-askers/all_time?page=1&pagesize=15&site=stackoverflow
            var url = this.__buildURL("tags/"+encodeURIComponent(tag)+"/top-askers/all_time",params);
            return this.__request__(url);
        },
        "topanswerers_by_tag": function(tag, params){
            // /2.1/tags/java/top-answerers/all_time?page=1&pagesize=15&site=stackoverflow
            var url = this.__buildURL("tags/"+encodeURIComponent(tag)+"/top-answerers/all_time",_.extend({},{
                "order": "desc",
                "page": "1",
                "pagesize": "30",
                "sort": "popular"
            },params));
            return this.__request__(url);
        },
        "tags": function(params){
            // tags?order=desc&sort=popular&site=stackoverflow
            var url = this.__buildURL("tags", _.extend({},{
                "order": "desc",
                "page": "1",
                "pagesize": "40",
                "sort": "popular"
            },params));
            return this.__request__(url);
        },
        "search_tags": function(srch, params){
            var url = this.__buildURL("tags/"+encodeURIComponent(srch)+"/info", _.extend({},{
                "order": "desc",
                "page": "1",
                "sort": "popular"
            },params));
            return this.__request__(url);
        },
        "questions": function(params){
            var url = this.__buildURL("questions", params);
            return this.__request__(url);
        },
        "questions_by_ids": function(ids, params){
            var url = this.__buildURL("questions/" + ids, params);
            return this.__request__(url);
        },
        "questions_by_users": function(ids,params){
            var url = this.__buildURL("users/"+ids+"/questions", _.extend({},question_search_defaults,params));
            return this.__request__(url);
        },
        "topquestions_by_users": function(ids,tags,params){
            // /users/{id}/tags/{tags}/top-questions
            var url = this.__buildURL("users/"+ids+"/tags/"+tags+"/top-questions", _.extend({},question_search_defaults,params));
            return this.__request__(url);
        },
        "topanswers_by_users": function(ids,tags,params){
            // /users/{id}/tags/{tags}/top-answers
            var url = this.__buildURL("users/"+ids+"/tags/"+tags+"/top-answers", _.extend({},question_search_defaults,params));
            return this.__request__(url);
        },
        "sites":function(params){
            var url = this.__buildURL("sites",params);
            return this.__request__(url);
        },
        "answer":function(id, params){
            var url = this.__buildURL("answers/"+id, params);
            return this.__request__(url);
        },
        "answers":function(params){
            var url = this.__buildURL("answers", params);
            return this.__request__(url);
        },
        "topanswers":function(params){
            // v1.1
            return this.answers(_.extend({},{
                "order": "desc",
                "body": "true",
                "page": "1",
                "pagesize": "20",
                "sort":"votes",
                "min": "100"
            },params));
        },
        "yesterdays_topanswers":function(params){
            var yest = new Date();
            yest.setDate( yest.getDate() - 1 );
            var today = new Date();
            return this.topanswers(_.extend({},{
                fromdate: Math.floor(yest.getTime() / 1000),
                todate: Math.floor(today.getTime() / 1000)
            },params));
        }
    };

});
