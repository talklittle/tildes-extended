/* globals $ */
const clog = console.log.bind(console);

// CORS ANYWHERE pass-through
$.ajaxPrefilter(function(options) {
    if (options.crossDomain && $.support.cors) {
        options.url = 'https://cors-anywhere.herokuapp.com/' + options.url;
    }
});

const defaultSettings = {
  initialSetup: true,
  linkNewTab: {
    enabled: true,
    types: ['text_submissions_links', 'link_submissions', 'comment_links']
  },
  jumpToNewComment: {
    enabled: true
  },
  customStyles: {
    enabled: false,
    urls: [],
    customCss: '',
    source: ''
  },
  markdownPreview: {
    enabled: true
  },
  usersLabel: {
    enabled: true
  },
  stickyHeader: {
    enabled: true
  }
};

function loadOptions() {
  if (navigator.userAgent.indexOf("Firefox") !== -1) {
    $("#custom_styles_url_div")
      .append("<br><span>Note: Firefox will not allow this to be loaded unless you open <code>about:config</code>, search the flag <code>security.csp.enable</code> and disable it.</span>")
  } else {
    $("#custom_styles_url_div")
      .append("<br><span>Please be aware that we're not checking the CSS validity</span>")
  }

  chrome.storage.local.get({
    tildesExtendedSettings: defaultSettings
  }, function(config) {
    if(config.tildesExtendedSettings.initialSetup) {
      delete config.tildesExtendedSettings.initialSetup;
      chrome.storage.local.set({ tildesExtendedSettings: config.tildesExtendedSettings}, () => {
        clog('Initial Config stored:', config.tildesExtendedSettings);
      });
    }
    // Link in New Tab
    $('#link_new_tab_enabled').prop("checked", config.tildesExtendedSettings.linkNewTab.enabled);
    $('#link_new_tab_type_text_submissions').prop("checked", config.tildesExtendedSettings.linkNewTab.types.findIndex(i => i === 'text_submissions') !== -1);
    $('#link_new_tab_type_text_submissions_links').prop("checked", config.tildesExtendedSettings.linkNewTab.types.findIndex(i => i === 'text_submissions_links') !== -1);
    $('#link_new_tab_type_link_submissions').prop("checked", config.tildesExtendedSettings.linkNewTab.types.findIndex(i => i === 'link_submissions') !== -1);
    $('#link_new_tab_type_comment_links').prop("checked", config.tildesExtendedSettings.linkNewTab.types.findIndex(i => i === 'comment_links') !== -1);
    $('#link_new_tab_type_users').prop("checked", config.tildesExtendedSettings.linkNewTab.types.findIndex(i => i === 'users') !== -1);
    // Jump to New Comment
    $('#jump_new_comment_enabled').prop("checked", config.tildesExtendedSettings.jumpToNewComment.enabled);
    // Markdown Preview
    $('#markdown_preview_enabled').prop("checked", config.tildesExtendedSettings.markdownPreview.enabled);
    // Users Label
    $('#users_label_enabled').prop("checked", config.tildesExtendedSettings.usersLabel.enabled);
    // Sticky Header
    $('#sticky_header_enabled').prop("checked", config.tildesExtendedSettings.stickyHeader.enabled);
    // Load Custom Styles
    $('#custom_styles_enabled').prop("checked", config.tildesExtendedSettings.customStyles.enabled);
    $('#custom_styles_urls').val(config.tildesExtendedSettings.customStyles.urls.join(','));
    $('#custom_styles_textarea').val(config.tildesExtendedSettings.customStyles.customCss);
    if($('#custom_styles_enabled').prop("checked", config.tildesExtendedSettings.customStyles.enabled)) {
      $('#custom_styles_urls').attr('disabled', false);
      $('#custom_styles_local').attr('disabled', false);

      $('#custom_styles_urls').val(config.tildesExtendedSettings.customStyles.urls.join(', '));
      $('#custom_styles_local').val(config.tildesExtendedSettings.customStyles.localCss);
    }
    $('#custom_styles_enabled').change(function() {
        if ($(this).is(':checked')) {
          $('#custom_styles_urls').attr('disabled', false);
          $('#custom_styles_local').attr('disabled', false);
        } else {
          $('#custom_styles_urls').attr('disabled', true);
          $('#custom_styles_local').attr('disabled', true);

          $('#custom_styles_urls').val('');
          $('#custom_styles_local').val('');
        }
    });
  });
}

function saveOptions() {
  $('#options_save').attr('disabled', true);
  updateStatus('Saving...', 'loading');

  const options = {};
  options.linkNewTab = {
    enabled: $('#link_new_tab_enabled').prop('checked'),
    types: $("input[id^='link_new_tab_type_']").filter(':checked').map((i, el) => el.name).get()
  };
  options.jumpToNewComment = {
    enabled: $('#jump_new_comment_enabled').prop('checked')
  };
  options.markdownPreview = {
    enabled: $('#markdown_preview_enabled').prop("checked")
  };
  options.stickyHeader = {
    enabled: $('#sticky_header_enabled').prop("checked")
  }
  options.usersLabel = {
    enabled: $('#users_label_enabled').prop("checked")
  };
  options.customStyles = {
    enabled: $('#custom_styles_enabled').prop('checked'),
    localCss: $('#custom_styles_local').val(),
    urls: $('#custom_styles_urls').val().replace(/\s/g,'').split(','),
  };

  if (options.customStyles.enabled) {
    if (options.customStyles.urls.length) {
      // Add custom user CSS sources
      options.customStyles.source = options.customStyles.localCss.length ? options.customStyles.localCss : '';
      //Add external resources
      const urlSource = buildStylesheets(options.customStyles.urls)
      if (urlSource.type === 'error') {
        updateStatus('Error with remote stylesheets: <br>' + urlSource.message, 'failure', 10000);
      } else {
        options.customStyles.source += urlSource;
        storeConfig(options);
      }
    } else {
      storeConfig(options);
    }
  } else {
    options.customStyles.source = null;
    storeConfig(options);
  }
}

// Reach for remote resources and build the CSS to inject
// TODO: Use a synchronous approach. Everyone welcome to make this asynchronous
// TODO: just remember that saveOptions() as well will need to change to support it
function buildStylesheets(urls) {
  try {
    let externalSources = '';
    // Concatenate all external CSS sources
    if (urls.length) {
      for (let i = 0; i < urls.length; i++) {
        const res = $.ajax(urls[i], {'async': false});
        // clog('RES:', res.status, res.responseText)
        if (200 <= res.status && res.status < 300) {
          externalSources += '\r\n\r\n' + res.responseText;
        } else {
          throw `${urls[i]} returned: ${res.statusText} (${res.status})`;
        }
      }
    }
    return externalSources;
  } catch(err) {
    // clog('something wrong in building the styles:', err);
    return {'type': 'error', 'message': err};
  }
}

// Store in local storage
function storeConfig(options) {
  chrome.storage.local.set({
    tildesExtendedSettings: options
  }, function() {
    clog('Config updated:', options);

    $('#options_save').attr('disabled', false);
    updateStatus('Options Saved!<br>Remember to refresh Tildes.net for the changes to take effect!', 'success', 6000)
  });
}

// Manage Feedback to the user
function updateStatus(message, cssClass, removeAfter = false) {
  $('#options_status').removeClass();
  $('#options_status').addClass(cssClass);
  $('#options_status').html(message);

  if(removeAfter) {
    setTimeout(function() {
      $('#options_status').removeClass();
      $('#options_status').html('');
    }, removeAfter);
  }
}

$('#options_save').on('click', saveOptions);
$(document).on('DOMContentLoaded', loadOptions);
