(function() {
  var findStory, getComicURL, getCover, transformContributors, transformInfo, transformPages;

  $(function() {
    var afterResizeTimeout, app, changeTransitions, handleResize, setHeights;
    afterResizeTimeout = null;
    changeTransitions = function() {
      if (W() > 480) {
        return $('.slideleft, .slideright').each(function() {
          $(this).removeClass('slideleft');
          $(this).removeClass('slideright');
          return $(this).addClass('dissolve');
        });
      }
    };
    handleResize = function() {
      clearTimeout(afterResizeTimeout);
      afterResizeTimeout = setTimeout(function() {
        return $('.swipe li').each(function() {
          $(this).css('height', 0);
          $(this).css('height', 'auto');
          return $('.swipe li').imagesLoaded(function() {
            setHeights($('#comics .swipe li'));
            return setHeights($('#home .swipe li'));
          });
        });
      }, 500);
      if (W() > 480) {
        return $('#jqt').addClass('gt480');
      } else {
        return $('#jqt').removeClass('gt480');
      }
    };
    W(function() {
      return handleResize();
    });
    handleResize();
    setHeights = function(elements) {
      var max;
      max = -1;
      elements.each(function() {
        var h;
        h = $(this).height();
        if (h > max) return max = h;
      });
      return elements.each(function() {
        return $(this).css({
          'height': max
        });
      });
    };
    $(document).on('ajaxStart', function() {
      return console.log('ajaxStart');
    });
    $(document).on('ajaxComplete', function() {
      return console.log('ajaxComplete');
    });
    $(document).on('ajaxError', function() {
      humane.error.timeout = 10000;
      humane.error.clickToClose = true;
      humane.error('Sorry, there was an error with the site. Come back later!');
      return console.error('ajaxError', arguments);
    });
    window.jQT = new $.jQTouch({
      icon: '/ashcan.png',
      addGlossToIcon: false,
      startupScreen: '/ashcan_startup.png',
      statusBar: 'black-translucent',
      defaultAnimation: 'dissolve',
      formSelector: false
    });
    app = window.app = Stativus.createStatechart();
    app.addState('loading', {
      enterState: function() {
        return this.sendEvent('loadIndex');
      },
      loadIndex: function() {
        var _this = this;
        if (!this.getData('loaded')) {
          return $.getJSON('/data/index.json', function(indexData) {
            return _this.sendEvent('loadSiteInfo', indexData);
          });
        }
      },
      loadSiteInfo: function(data) {
        var comics, news,
          _this = this;
        comics = data.comics;
        news = data.news;
        return async.parallel({
          comics: function(done) {
            return async.map(comics, function(issue, next) {
              console.info("getting issue:", issue);
              return $.getJSON("/data/comics/" + issue + "/index.json", function(comicData) {
                comicData.issue = issue;
                comicData = transformInfo(comicData);
                comicData.pages = transformPages(comicData.pages);
                comicData.cover = getCover(comicData.pages);
                comicData.stories = transformContributors(comicData.stories);
                return next(null, comicData);
              });
            }, done);
          },
          news: function(done) {
            return done();
            return async.map(news, function(article, next) {
              return $.get("/data/news/" + article + ".md", function(newsData) {
                return next(null, newsData);
              });
            }, done);
          }
        }, function(err, results) {
          _this.setData('comics', results.comics);
          return _this.sendEvent('loaded');
        });
      },
      loaded: function() {
        this.setData('loaded', true);
        return this.goToState('base');
      }
    });
    app.addState('base', {
      parentState: 'loading',
      initialSubstate: window.location.hash,
      enterState: function() {
        var body;
        body = window.document.body;
        body.addEventListener('keydown', function(evt) {
          var kid, matchString;
          matchString = 'Up,Down,Right,Left,Enter';
          kid = evt.keyIdentifier;
          if (matchString.indexOf(kid) > -1) return app.sendEvent('key' + kid);
        }, false);
        return this.goToState(window.location.hash);
      },
      pageChange: function(page) {
        return this.goToState(page);
      }
    });
    app.addState('#home', {
      parentState: 'base',
      enterState: function() {
        var bullets, comicHTML, comicTemplate, comics, setupBullets;
        app.currentIssue = null;
        if (!window.comicSlider) {
          comics = this.getData('comics');
          comicTemplate = Hogan.compile($('#swipe-comics-template').text());
          comicHTML = comicTemplate.render({
            comics: comics
          });
          $('#home .inject').html(comicHTML);
          molt.discover();
          bullets = $('#home .position em');
          setupBullets = function(pos) {
            bullets.each(function(index, bullet) {
              return bullet.className = ' ';
            });
            return bullets[pos].className = 'on';
          };
          comics = $('#home .swipe')[0];
          window.comicSlider = window.comicSlider || new Swipe(comics, {
            continuous: true,
            callback: setupBullets
          });
          setupBullets(0);
          $('#home .swipe').imagesLoaded(function() {
            return setHeights($('#home .swipe li'));
          });
          $('#home .swipe a').click(function() {
            return app.currentIssue = $(this).attr('data-issue');
          });
          changeTransitions();
        }
        return true;
      },
      keyLeft: function() {
        return window.comicSlider.prev();
      },
      keyRight: function() {
        return window.comicSlider.next();
      },
      exitState: function() {
        return window.slider;
      }
    });
    app.addState('#about', {
      parentState: 'base',
      enterState: function() {
        return changeTransitions();
      }
    });
    app.addState('#donate', {
      parentState: 'base',
      enterState: function() {
        return changeTransitions();
      }
    });
    app.addState('#menu', {
      parentState: 'base',
      enterState: function() {
        return changeTransitions();
      }
    });
    app.addState('#thanks', {
      parentState: 'base',
      enterState: function() {
        return changeTransitions();
      }
    });
    app.addState('#comic', {
      parentState: 'base',
      enterState: function() {
        var bullets, comics, detailHTML, detailTemplate, issue, setupBullets;
        app.currentStory = null;
        if (!(app.currentIssue != null)) app.currentIssue = 1;
        issue = this.getData('comics')[app.currentIssue - 1];
        detailTemplate = Hogan.compile($('#comic-detail-template').text());
        detailHTML = detailTemplate.render(issue);
        $('#comic .inject').html(detailHTML);
        $('#comic .toolbar h1').html("Issue " + app.currentIssue + " Preview");
        molt.discover();
        $('#comic .buy').click(function() {
          return $('#comic .buy form').submit();
        });
        $('#comic .stories a').click(function() {
          return app.currentStory = $(this).attr('data-story');
        });
        $('#comic .inject').css('visibility', 'visible');
        bullets = $('#comic .position em');
        setupBullets = function(pos) {
          bullets.each(function(index, bullet) {
            return bullet.className = ' ';
          });
          return bullets[pos].className = 'on';
        };
        comics = $('#comic .swipe')[0];
        delete window.pageSlider;
        window.pageSlider = new Swipe(comics, {
          continuous: true,
          callback: setupBullets
        });
        setupBullets(0);
        $('#comic .swipe').imagesLoaded(function() {
          return setHeights($('#comic .swipe li'));
        });
        return changeTransitions();
      },
      keyLeft: function() {
        return window.pageSlider.prev();
      },
      keyRight: function() {
        return window.pageSlider.next();
      },
      exitState: function() {
        return $('#comic .inject').css('visibility', 'hidden');
      }
    });
    app.addState('#contributor', {
      parentState: 'base',
      enterState: function() {
        var contributionHTML, contributionTemplate, issue, story;
        if (!(app.currentIssue != null)) app.currentIssue = 1;
        issue = this.getData('comics')[app.currentIssue - 1];
        story = findStory(issue, app.currentStory);
        contributionTemplate = Hogan.compile($('#contribution-detail-template').text());
        contributionHTML = contributionTemplate.render(story);
        $('#contributor .inject').html(contributionHTML);
        $('#contributor .toolbar h1').html(story.name);
        return changeTransitions();
      }
    });
    app.addState('#news', {
      parentState: 'base',
      enterState: function() {
        return changeTransitions();
      }
    });
    app.addState('#news-1', {
      parentState: 'base',
      enterState: function() {
        return changeTransitions();
      }
    });
    app.initStates('loading', 'base');
    return $('body').on('pageAnimationEnd', function(event, data) {
      if (data.direction === 'in') {
        return app.sendEvent('pageChange', '#' + event.target.id);
      }
    });
  });

  transformPages = function(pages) {
    if (!(pages != null)) console.error('pages not found!', pages);
    return pages.map(function(url) {
      url = url.replace('http://ashcan-data.staticloud.com', '/data');
      return url = url.replace(/(\.jpg)/, '');
    });
  };

  getCover = function(pages) {
    return pages.shift();
  };

  getComicURL = function(comic) {
    return '#comic';
  };

  findStory = function(issue, storyData) {
    var story, _i, _len, _ref;
    if (!(storyData != null)) return issue.stories[0];
    _ref = issue.stories;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      story = _ref[_i];
      if (story.name === storyData) return story;
    }
    console.error('could not find story: ', storyData);
  };

  transformInfo = function(info) {
    if (!info.description) info.description = '<em>No Description Yet!</em>';
    return info;
  };

  transformContributors = function(stories) {
    return stories.map(function(story) {
      story.contributors = story.contributors.map(function(contributor) {
        if (!(contributor.url != null)) {
          contributor.url = 'No contact details supplied';
          return contributor;
        } else {
          if (contributor.url.slice(0, 4) !== 'http') {
            contributor.url = "mailto:" + contributor.url;
            contributor.url = contributor.url.replace('.', ' [dot] ');
          }
          return contributor;
        }
      });
      return story;
    });
  };

}).call(this);
