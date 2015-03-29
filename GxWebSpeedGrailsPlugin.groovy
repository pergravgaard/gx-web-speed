class GxWebSpeedGrailsPlugin {
    // the plugin version
    def version = "0.2"
    // the version or versions of Grails the plugin is designed for
    def grailsVersion = "2.4 > *"
    // resources that are excluded from plugin packaging
    def pluginExcludes = [
        //"grails-app/views/error.gsp"
		//"grails-app/controllers/RestController.groovy" // TODO: How to exclude a controller?
    ]

    // TODO Fill in these fields
    def title = "GxWebSpeed Plugin" // Headline display name of the plugin
    def author = "Per Gravgaard"
    def authorEmail = "per.gravgaard@gmail.com"
    def description = '''\
Brief summary/description of the plugin.
'''

    // URL to the plugin's documentation
    def documentation = "http://grails.org/plugin/gx-web-speed"

    // Extra (optional) plugin metadata

    // License: one of 'APACHE', 'GPL2', 'GPL3'
//    def license = "APACHE"

    // Details of company behind the plugin (if there is one)
    def organization = [ name: "Grailshouse", url: "http://pergravgaard.com/" ]

    // Any additional developers beyond the author specified above.
//    def developers = [ [ name: "Joe Bloggs", email: "joe@bloggs.net" ]]

    // Location of the plugin's issue tracker.
//    def issueManagement = [ system: "JIRA", url: "http://jira.grails.org/browse/GPMYPLUGIN" ]

    // Online location of the plugin's browseable source code.
//    def scm = [ url: "http://svn.codehaus.org/grails-plugins/" ]

    def doWithWebDescriptor = { xml ->
		def filters = xml.'filter'
		filters[filters.size() - 1] + {
			'filter' {
				'filter-name'('LocaleFilter')
				'filter-class'('com.grailshouse.webspeed.filter.LocaleFilter')
//				'init-param' {
//					'param-name'('supportedLocales')
//					'param-value'('fr_FR,de')
//				}
			}
			'filter' {
				'description'("This filter removes a possible 'www' in the domain part of the URL. This is in order to avoid the duplicate content issue with respect to Search Engine Optimization.")
				'filter-name'('DomainFilter')
				'filter-class'('com.grailshouse.webspeed.filter.DomainFilter')
			}
		}

		def filterMappings = xml.'filter-mapping'
		filterMappings[filterMappings.size() - 1] + {
			'filter-mapping' {
				'filter-name'('LocaleFilter')
				'url-pattern'('/*')
				'dispatcher'('REQUEST')
			}
			'filter-mapping' {
				'filter-name'("DomainFilter")
				'url-pattern'("/*")
				'dispatcher'("REQUEST")
			}
		}
    }

    def doWithSpring = {

		commonDatePropertyEditorRegistrar(com.grailshouse.webspeed.propertyeditor.DatePropertyEditorRegistrar)
	
		fileProcessor(com.grailshouse.webspeed.resource.FileProcessor) {
			grailsApplication = ref('grailsApplication')
		}

//		if (!springConfig.containsBean('grailsLinkGenerator')) {
//			grailsLinkGenerator(HalfBakedLegacyLinkGenerator) {
//				pluginManager = ref('pluginManager')
//			}
//		}
//		
//		grailsResourceProcessor(org.grails.plugin.resource.ResourceProcessor) {
//			grailsLinkGenerator = ref('grailsLinkGenerator')
//			if (springConfig.containsBean('grailsResourceLocator')) {
//				grailsResourceLocator = ref('grailsResourceLocator')
//			}
//			grailsApplication = ref('grailsApplication')
//		}
//		
//		// Legacy service name
//		springConfig.addAlias "resourceService", "grailsResourceProcessor"

    }

    def doWithDynamicMethods = { ctx ->
        // Implement registering dynamic methods to classes (optional)
    }

    def doWithApplicationContext = { applicationContext ->
        // Implement post initialization spring config (optional)
    }

    def onChange = { event ->
        // Implement code that is executed when any artefact that this plugin is
        // watching is modified and reloaded. The event contains: event.source,
        // event.application, event.manager, event.ctx, and event.plugin.
    }

    def onConfigChange = { event ->
        // Implement code that is executed when the project configuration changes.
        // The event is the same as for 'onChange'.
    }

    def onShutdown = { event ->
        // Implement code that is executed when the application shuts down (optional)
    }
	
	def getWebXmlFilterOrder() {
		def FilterManager = getClass().getClassLoader().loadClass('grails.plugin.webxml.FilterManager')
		return [
			DomainFilter: FilterManager.DEFAULT_POSITION - 102,
			charEncodingFilter: FilterManager.DEFAULT_POSITION - 101, // must come before locale filter to avoid issues with danish characters
			LocaleFilter: FilterManager.DEFAULT_POSITION - 100
		]
	}

}
