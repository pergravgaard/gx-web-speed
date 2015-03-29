class GxWebSpeedUrlMappings {

	static mappings = {
		//"/$controller/$actionOrId?/$id?" {
        "/$controller/$actionOrId?/$id?(.$format)?" {
			action = {
				def id = params.long('actionOrId')
                if (!id && params.actionOrId?.matches('[a-zA-Z0-9]{32}')) { // support uuid as id as well
                    id = params.actionOrId
                }
				if (id) {
					params.id = id
					return [GET: "show", PUT: "update", DELETE: "delete", POST: "save"]."${request.method}"
				}
				def a = params.actionOrId
				switch (request.method) {
					case 'POST':
						if (a == 'create') {
							return 'save'
						}
					case 'PUT':
						if (a == 'edit') {
							return 'update'
						}
					case 'DELETE':
						if (a == 'show') {
							return 'delete'
						}
					case 'GET':
					default:
						return a
				}
			}
			constraints {
				// apply constraints here
			}
		}
		'500'(view: '/error')
        '503'(view: '/error')
        '404'(view: '/404')
		'405'(view: '/405')
	}

}