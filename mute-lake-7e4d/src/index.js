addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});

var basedomain = "d3v-verschoren";
var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic {token}'
}
var basedomain, ticket_id;

async function handleRequest(request) {
    
    const requestURL = new URL(request.url);
    //Get POST data

	return await handleFlow();
}

async function handleFlow(){
    let support_emails = await getSupportAddress();
    let ticket = await getTicket(ticket_id)
    let recipients = await getAudit(ticket_id)
    console.log(ticket_id,support_emails,ticket,recipients)
    
    for (const recipient of recipients) {
        console.log(`Comparing original ${ticket.ticket.recipient} and new ${recipient}`)
        if (ticket.ticket.recipient == recipient){
            console.log("Existing ticket for: "+recipient)
        } else if (support_emails.includes(recipient)){
            var new_ticket = await createTicket(ticket,recipient)
            console.log("created ticket "+new_ticket+" for: "+recipient)
            log.push(new_ticket)
        } else {
            console.log("Not a support email: "+recipient)
        }
    }

    return new Response(`Created ${log.length} tickets: ${log.toString()}`)
}

async function getSupportAddress(){
    const init = {
        method: 'GET',
        headers: headers
    }
    
    const result = await fetch('https://'+basedomain+'.zendesk.com/api/v2/recipient_addresses', init)
    let json = await result.json();
    console.log(json);
    var adres_array = [];
    for (const element of json.recipient_addresses) {
        adres_array.push(element.email)
    }
    return adres_array;
}

async function getTicket(ticket_id){
    const init = {
        method: 'GET',
        headers: headers
    }

    const result = await fetch('https://'+basedomain+'.zendesk.com/api/v2/tickets/'+ticket_id+'.json', init)
    let json = await result.json();
    return json;
}

async function getAudit(ticket_id){
    const init = {
        method: 'GET',
        headers: headers
    }
    
    const result = await fetch('https://'+basedomain+'.zendesk.com/api/v2/tickets/'+ticket_id+'/audits', init)
    let json = await result.json();
    let audit = json.audits[0];
    console.log(audit)
    if (audit.via.channel == "email"){
        var recipients = audit.via.source.from.original_recipients
        return recipients
    } else {
        return []
    }
}

async function createTicket(original,recipient){
    var payload = JSON.parse(JSON.stringify(original));
    var ticket = {
		"ticket": {
			"subject": original.ticket.subject,
			"comment": {
				"html_body": `Split from ticket #${ticket_id}<br>${original.ticket.description}`,
			},
			"recipient": recipient,
			"requester_id": original.ticket.requester_id,
			"via": {
				"channel": "mail",
			}
		}
	}

    const init = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(ticket)
    }
    const result = await fetch('https://'+basedomain+'.zendesk.com/api/v2/tickets.json', init)
    var json = await result.json()
    return json.audit.ticket_id
}