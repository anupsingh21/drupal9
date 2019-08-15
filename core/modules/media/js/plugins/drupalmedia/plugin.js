/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/

(function (jQuery, Drupal, CKEDITOR) {
  function getFocusedWidget(editor) {
    var widget = editor.widgets.focused;

    if (widget && widget.name === 'drupalmedia') {
      return widget;
    }
    return null;
  }

  function linkCommandIntegrator(editor) {
    if (!editor.plugins.drupallink) {
      return;
    }

    CKEDITOR.plugins.drupallink.registerLinkableWidget('drupalmedia');

    editor.getCommand('drupalunlink').on('exec', function (evt) {
      var widget = getFocusedWidget(editor);

      if (!widget) {
        return;
      }

      widget.setData('link', null);

      this.refresh(editor, editor.elementPath());

      evt.cancel();
    });

    editor.getCommand('drupalunlink').on('refresh', function (evt) {
      var widget = getFocusedWidget(editor);

      if (!widget) {
        return;
      }

      this.setState(widget.data.link ? CKEDITOR.TRISTATE_OFF : CKEDITOR.TRISTATE_DISABLED);

      evt.cancel();
    });

    if (editor.contextMenu) {
      editor.contextMenu.addListener(function () {
        var widget = getFocusedWidget(editor);

        if (!widget) {
          return;
        }

        if (widget.data.link) {
          return {
            link: CKEDITOR.TRISTATE_OFF,
            unlink: CKEDITOR.TRISTATE_OFF
          };
        }
        return {};
      });
    }
  }

  Drupal.theme.mediaEmbedError = function () {
    var error = Drupal.t('An error occurred while trying to preview the media. Please save your work and reload this page.');
    return '<div class="media-embed-error media-embed-error--preview-error">' + error + '</div>';
  };

  CKEDITOR.plugins.add('drupalmedia', {
    requires: 'widget',

    beforeInit: function beforeInit(editor) {
      var dtd = CKEDITOR.dtd;

      dtd['drupal-media'] = { '#': 1 };

      Object.keys(dtd).forEach(function (tagName) {
        if (dtd[tagName].div) {
          dtd[tagName]['drupal-media'] = 1;
        }
      });
      dtd.a['drupal-media'] = 1;

      editor.widgets.add('drupalmedia', {
        allowedContent: 'drupal-media[data-entity-type,data-entity-uuid,data-view-mode,data-align,data-caption,alt,title]',

        requiredContent: 'drupal-media[data-entity-type,data-entity-uuid]',

        pathName: Drupal.t('Embedded media'),

        editables: {
          caption: {
            selector: 'figcaption',
            allowedContent: 'a[!href]; em strong cite code br',
            pathName: Drupal.t('Caption')
          }
        },

        upcast: function upcast(element, data) {
          var attributes = element.attributes;

          if (element.name !== 'drupal-media' || attributes['data-entity-type'] !== 'media' || attributes['data-entity-uuid'] === undefined) {
            return;
          }
          data.attributes = CKEDITOR.tools.copy(attributes);
          data.hasCaption = data.attributes.hasOwnProperty('data-caption');
          data.link = null;
          if (element.parent.name === 'a') {
            data.link = CKEDITOR.tools.copy(element.parent.attributes);

            Object.keys(element.parent.attributes).forEach(function (attrName) {
              if (attrName.indexOf('data-cke-') !== -1) {
                delete data.link[attrName];
              }
            });
          }
          return element;
        },
        destroy: function destroy() {
          this._tearDownDynamicEditables();
        },
        data: function data(event) {
          if (this._previewNeedsServerSideUpdate()) {
            editor.fire('lockSnapshot');
            this._tearDownDynamicEditables();

            this._loadPreview(function (widget) {
              widget._setUpDynamicEditables();
              editor.fire('unlockSnapshot');
            });
          }

          this.element.setAttributes(this.data.attributes);

          if (this.data.attributes.hasOwnProperty('data-align')) {
            this.element.getParent().addClass('align-' + this.data.attributes['data-align']);
          }

          this.oldData = CKEDITOR.tools.clone(this.data);
        },
        downcast: function downcast() {
          var downcastElement = new CKEDITOR.htmlParser.element('drupal-media', this.data.attributes);
          if (this.data.link) {
            var link = new CKEDITOR.htmlParser.element('a', this.data.link);
            link.add(downcastElement);
            return link;
          }
          return downcastElement;
        },
        _setUpDynamicEditables: function _setUpDynamicEditables() {
          var _this = this;

          if (this.initEditable('caption', this.definition.editables.caption)) {
            var captionEditable = this.editables.caption;

            captionEditable.setAttribute('data-placeholder', Drupal.t('Enter caption here'));

            this.captionObserver = new MutationObserver(function () {
              var mediaAttributes = CKEDITOR.tools.clone(_this.data.attributes);
              mediaAttributes['data-caption'] = captionEditable.getData();
              _this.setData('attributes', mediaAttributes);
            });
            this.captionObserver.observe(captionEditable.$, {
              characterData: true,
              attributes: true,
              childList: true,
              subtree: true
            });
          }
        },
        _tearDownDynamicEditables: function _tearDownDynamicEditables() {
          if (this.captionObserver) {
            this.captionObserver.disconnect();
          }
        },
        _previewNeedsServerSideUpdate: function _previewNeedsServerSideUpdate() {
          if (!this.ready) {
            return true;
          }

          return this._hashData(this.oldData) !== this._hashData(this.data);
        },
        _hashData: function _hashData(data) {
          var dataToHash = CKEDITOR.tools.clone(data);

          delete dataToHash.attributes['data-caption'];

          if (dataToHash.link) {
            delete dataToHash.link.href;
          }
          return JSON.stringify(dataToHash);
        },
        _loadPreview: function _loadPreview(callback) {
          var _this2 = this;

          jQuery.get({
            url: Drupal.url('media/' + editor.config.drupal.format + '/preview'),
            data: {
              text: this.downcast().getOuterHtml()
            },
            dataType: 'html',
            success: function success(previewHtml) {
              _this2.element.setHtml(previewHtml);
              callback(_this2);
            },
            error: function error() {
              _this2.element.setHtml(Drupal.theme('mediaEmbedError'));
            }
          });
        }
      });
    },
    afterInit: function afterInit(editor) {
      linkCommandIntegrator(editor);
    }
  });
})(jQuery, Drupal, CKEDITOR);