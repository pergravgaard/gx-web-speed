//import grails.util.GrailsNameUtils
//import grails.util.Metadata
//import groovy.text.SimpleTemplateEngine
import org.codehaus.groovy.grails.plugins.GrailsPluginUtils
//includeTargets << grailsScript("_GrailsInit")

target(main: "Installing CRUD View Templates!") {
	copyViewTemplates()
	println 'Done...'
}

setDefaultTarget(main)

private String getPluginDir() {
	return GrailsPluginUtils.pluginInfos.find { it.name == 'gx-web-speed' }.pluginDir.path
}

private void copyViewTemplates() {
	def pluginDir = getPluginDir()
	def toDir = "${basedir}/src/templates/scaffolding"
	ant.mkdir(dir: toDir)
	def fromDir = "${pluginDir}/src/templates/scaffolding"
	ant.copy(todir: toDir, overwrite: false) {
		fileset(dir: fromDir) {
			include name: '*.gsp'
//			include name: 'Controller.groovy'
//			include name: 'HackController.groovy'
//			include name: 'TagLibTestController.groovy'
		}
	}
}