var APIAdapter = Ember.Object.extend({
  apiRoot: 'http://localhost:3000',
  token: window.localStorage.token,

  initiateSession: function() {
    var newSessionURL = this.get('apiRoot') + '/session/new';
    window.location = newSessionURL;
  },

  ajax: function(type, path) {
    return Ember.$.ajax(this.get('apiRoot') + path, {
      type: type,
      headers: { 'X-OAuth-Token': this.get('token') }
    })
  }
});

window.App = Ember.Application.create({
  ready: function() {
    this.register('main:adapter', APIAdapter);
    this.inject('route', 'adapter', 'main:adapter');
  }
});

App.Token = Ember.Object.extend({
  token: null
});

App.Router.map(function() {
  this.route('token', { path: '/token/:token' });
  this.resource('user', function() {
    this.route('home');
    this.route('timeline', { path: '/timelines/:screen_name' });
  })
});

App.AuthenticatedRoute = Ember.Route.extend({
  beforeModel: function() {
    if (!this.adapter.get('token')) {
      this.adapter.initiateSession();
    }
  }
});

App.IndexRoute = Ember.Route.extend({
  beforeModel: function(transition) {
    return this.transitionTo('user.home');
  }
});

App.TokenRoute = Ember.Route.extend({
  model: function(params) {
    var token = params.token;
    window.localStorage.token = token;
    this.adapter.set('token', token);
    return token;
  },
  afterModel: function(model, transition) {
    this.transitionTo('index');
  }
});

App.UserRoute = App.AuthenticatedRoute.extend({
  model: function() {
    return this.adapter.ajax('GET', '/user.json');
  }
});

App.UserHomeRoute = App.AuthenticatedRoute.extend({
  setupController: function(controller, model) {
    var tweetsPromise = this.adapter.ajax('GET', '/twitter/timelines/home.json');
    tweetsPromise.then(function(tweets) {
      controller.set('tweets', tweets);
    });
  }
});

App.UserTimelineRoute = App.AuthenticatedRoute.extend({
  model: function(params) {
    return this.adapter.ajax('GET', '/twitter/users/' + params.screen_name + '.json');
  },
  setupController: function(controller, model) {
    var tweetsPromise = this.adapter.ajax('GET', '/twitter/timelines/' + model.screen_name + '.json');
    tweetsPromise.then(function(tweets) {
      controller.set('tweets', tweets);
    });
  }
});

App.UserController = Ember.ObjectController.extend();
//TODO: We can probably remove that once user timelines work
App.UserHomeController = Ember.ObjectController.extend({
  tweets: []
});
App.UserTimelineController = Ember.ObjectController.extend({
  tweets: []
});

App.TweetController = Ember.ObjectController.extend({
  biggerProfileImage: function() {
    return this.get('user.profile_image_url').replace('normal', 'bigger');
  }.property('user.profile_image_url')
});

Ember.Handlebars.helper('html', function(tweet, options) {
  var replaceUrls = function(text, urlData) {
    var start = urlData.indices[0];
    var end   = urlData.indices[1];
    return text.slice(0, start) + '<a href="' + urlData.expanded_url + '">' + urlData.display_url + '</a>' + text.slice(end);
  }

  // Essentially there is no way to extract urls from RTs from the data Twitter provides
  // so we might as well go simply matching urls in the text
  var text = tweet.get('text').replace(/\n/g, '<br />');
  var urlEntities = tweet.get('entities.urls');

  var withUrls = text;
  urlEntities.forEach(function(urlData) {
    //FIXME: This breaks when there are multiple urls
    withUrls = replaceUrls(text, urlData);
  });

  var mediaEntities = tweet.get('entities.media') || [];
  mediaEntities.forEach(function(urlData) {
    withUrls = replaceUrls(withUrls, urlData);
  });

  return new Handlebars.SafeString(withUrls);
});

