$ ->
  afterResizeTimeout = null
  changeTransitions = ->
    if W() > 480
      $('.slideleft, .slideright').each ->
        $(this).removeClass('slideleft')
        $(this).removeClass('slideright')
        $(this).addClass('dissolve')

  handleResize = ->
    clearTimeout(afterResizeTimeout)
    afterResizeTimeout = setTimeout ->
      $('.swipe li').each ->
        $(this).css('height', 0)
        $(this).css('height', 'auto')
        $('.swipe li').imagesLoaded ->
          setHeights($('#comics .swipe li'))
          setHeights($('#home .swipe li'))
    , 500
    if W() > 480
      $('#jqt').addClass('gt480')
    else
      $('#jqt').removeClass('gt480')
  W ->
    handleResize()
  handleResize()

  setHeights = (elements) ->
    max = -1
    elements.each ->
      h = $(this).height()
      if h > max
        max = h
    elements.each ->
      $(this).css({'height': max})

  $(document).on('ajaxStart', ->
    console.log('ajaxStart')
  )
  $(document).on('ajaxComplete', ->
    console.log('ajaxComplete')
  )
  $(document).on('ajaxError', ->
    humane.error.timeout = 10000
    humane.error.clickToClose = true
    humane.error('Sorry, there was an error with the site. Come back later!')
    console.error('ajaxError', arguments)
  )

  window.jQT = new $.jQTouch
    icon: '/ashcan.png'
    addGlossToIcon: false
    startupScreen: '/ashcan_startup.png'
    statusBar: 'black-translucent'
    defaultAnimation: 'dissolve'
    formSelector: false

  app = window.app = Stativus.createStatechart()
  app.addState 'loading',
    enterState: ->
      @sendEvent('loadIndex')
    loadIndex: ->
      if not @getData('loaded')
        $.getJSON '/data/index.json', (indexData) =>
          @sendEvent('loadSiteInfo', indexData)
    loadSiteInfo: (data) ->
      comics = data.comics
      news = data.news
      async.parallel({
        comics: (done) =>
          async.map(comics, (issue, next) =>
            console.info("getting issue:", issue)
            $.getJSON "/data/comics/#{issue}/index.json", (comicData) =>
              comicData.issue = issue
              comicData = transformInfo(comicData)
              comicData.pages = transformPages(comicData.pages)
              comicData.cover = getCover(comicData.pages)
              comicData.stories = transformContributors(comicData.stories)
              next(null, comicData)
          , done)
        news: (done) =>
          return done() # shortcut
          async.map(news, (article, next) =>
            $.get "/data/news/#{article}.md", (newsData) =>
              next(null, newsData)
          , done)
      }, (err, results) =>
        @setData('comics', results.comics)
        #@setData('news', results.news)
        @sendEvent('loaded')
      )
    loaded: ->
      @setData('loaded', true)
      @goToState('base')

  app.addState 'base',
    parentState: 'loading'
    initialSubstate: window.location.hash
    enterState: ->
      body = window.document.body
      body.addEventListener 'keydown', (evt) ->
        matchString = 'Up,Down,Right,Left,Enter'
        kid = evt.keyIdentifier
        if matchString.indexOf(kid)>-1
          app.sendEvent('key'+kid)
      , false
      @goToState(window.location.hash)

    pageChange: (page) ->
      @goToState(page)

  app.addState '#home',
    parentState: 'base'
    enterState: ->
      app.currentIssue = null
      if not window.comicSlider
        comics = @getData('comics')
        comicTemplate = Hogan.compile($('#swipe-comics-template').text())
        comicHTML = comicTemplate.render({comics: comics})
        $('#home .inject').html comicHTML
        molt.discover()

        bullets = $('#home .position em')
        setupBullets = (pos) ->
          bullets.each (index, bullet) ->
            bullet.className = ' '
          bullets[pos].className = 'on'

        comics = $('#home .swipe')[0]
        window.comicSlider = window.comicSlider || new Swipe comics,
          continuous: true
          callback: setupBullets

        setupBullets(0)

        $('#home .swipe').imagesLoaded ->
          setHeights($('#home .swipe li'))
        $('#home .swipe a').click ->
          app.currentIssue = $(this).attr('data-issue')
        changeTransitions()

      return true

    keyLeft: ->
      window.comicSlider.prev()
    keyRight: ->
      window.comicSlider.next()
    exitState: ->
      window.slider


  app.addState '#about',
    parentState: 'base'
    enterState: ->
      changeTransitions()

  app.addState '#donate',
    parentState: 'base'
    enterState: ->
      changeTransitions()

  app.addState '#menu',
    parentState: 'base'
    enterState: ->
      changeTransitions()

  app.addState '#thanks',
    parentState: 'base'
    enterState: ->
      changeTransitions()

  app.addState '#comic',
    parentState: 'base'
    enterState: ->
      app.currentStory = null
      if not app.currentIssue?
        app.currentIssue = 1

      issue = @getData('comics')[app.currentIssue - 1]
      detailTemplate = Hogan.compile($('#comic-detail-template').text())
      detailHTML = detailTemplate.render(issue)
      $('#comic .inject').html detailHTML
      $('#comic .toolbar h1').html "Issue #{app.currentIssue} Preview"
      molt.discover()
      $('#comic .buy').click ->
        $('#comic .buy form').submit()

      $('#comic .stories a').click ->
        app.currentStory = $(this).attr('data-story')

      $('#comic .inject').css('visibility', 'visible')
      bullets = $('#comic .position em')
      setupBullets = (pos) ->
        bullets.each (index, bullet) ->
          bullet.className = ' '
        bullets[pos].className = 'on'

      comics = $('#comic .swipe')[0]
      delete window.pageSlider
      window.pageSlider = new Swipe comics,
        continuous: true
        callback: setupBullets

      setupBullets(0)

      $('#comic .swipe').imagesLoaded ->
        setHeights($('#comic .swipe li'))

      changeTransitions()
    keyLeft: ->
      window.pageSlider.prev()
    keyRight: ->
      window.pageSlider.next()
    exitState: ->
      $('#comic .inject').css('visibility', 'hidden')

  app.addState '#contributor',
    parentState: 'base'
    enterState: ->
      if not app.currentIssue? 
        app.currentIssue = 1
      
      issue = @getData('comics')[app.currentIssue - 1]
      story = findStory(issue, app.currentStory)
      contributionTemplate = Hogan.compile($('#contribution-detail-template').text())
      contributionHTML = contributionTemplate.render(story)
      $('#contributor .inject').html contributionHTML
      $('#contributor .toolbar h1').html story.name
      changeTransitions()

  app.addState '#news',
    parentState: 'base'
    enterState: ->
      changeTransitions()
  app.addState '#news-1',
    parentState: 'base'
    enterState: ->
      changeTransitions()

  app.initStates('loading', 'base')

  $('body').on 'pageAnimationEnd', (event, data) ->
    if (data.direction == 'in')
      app.sendEvent('pageChange', '#' +  event.target.id)

transformPages = (pages) ->
  if not pages?
    console.error('pages not found!', pages)
  pages.map (url) ->
    url = url.replace('http://ashcan-data.staticloud.com', '/data')
    url = url.replace(/(\.jpg)/, '')

getCover = (pages) ->
  pages.shift()

getComicURL = (comic) ->
  '#comic'

findStory = (issue, storyData) ->
  if not storyData?
    return issue.stories[0]
  for story in issue.stories
    if story.name is storyData
      return story
  console.error('could not find story: ', storyData)
  return

transformInfo = (info) ->
  if !info.description
    info.description = '<em>No Description Yet!</em>'
  return info

transformContributors = (stories) ->
  stories.map (story) ->
    story.contributors = story.contributors.map (contributor) ->
      if not contributor.url?
        contributor.url = 'No contact details supplied'
        return contributor
      else
        if contributor.url.slice(0, 4) isnt 'http'
          contributor.url = "mailto:#{contributor.url}"
          contributor.url = contributor.url.replace('.', ' [dot] ')
        return contributor
    return story

