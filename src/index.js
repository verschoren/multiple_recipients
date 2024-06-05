/*
  {"ticket":1817}
*/
var worker_default = {
    async fetch(request, env) {
      
      if (request.method != 'POST'){ return new Response("Method not supported", {status: 405}); }
      
      //Get ticket ID
      var payload = await request.json();
      const ticket_id = payload.ticket ? payload.ticket : '';
      if (ticket_id == ''){ return new Response("No ticket ID passed", {status: 406}); }
      
      //Get auth variables
      const subdomain = env.SUBDOMAIN;
      const token = env.TOKEN;
      const headers  = {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + token
      }
  
      //Get context
      let support_emails = await getSupportAddress(subdomain,headers);
      let ticket = await getTicket(ticket_id,subdomain,headers)
      let recipients = await getAudit(ticket_id,subdomain,headers)
  
      for (const recipient of recipients) {
        console.log(`Comparing original ${ticket.recipient} and new ${recipient}`)
        if (ticket.recipient == recipient){
          console.log(`Skipped. Existing ticket for ${recipient}`)
        } else if (support_emails.includes(recipient)){
          var new_ticket = await createTicket(ticket,recipient,ticket_id,subdomain,headers)
          console.log(`created ticket ${new_ticket} for ${recipient}`)
        } else {
          console.log(`Skipped. ${recipient} is not a support email.`)
        }
      }
      return new Response(`Created tickets`);
    }
  };
  
  export {
    worker_default as default
  };
  
  async function getSupportAddress(subdomain,headers){
    const init = {
        method: 'GET',
        headers: headers
    }
    
    const result = await fetch('https://'+subdomain+'.zendesk.com/api/v2/recipient_addresses', init)
    let json = await result.json();
    var adres_array = [];
    for (const element of json.recipient_addresses) {
      adres_array.push(element.email)
    }
    console.log("addresses", adres_array);
    return adres_array;
  }
  
  async function getTicket(ticket_id,subdomain,headers){
    const init = {
        method: 'GET',
        headers: headers
    }
  
    const result = await fetch('https://'+subdomain+'.zendesk.com/api/v2/tickets/'+ticket_id+'.json', init)
    let json = await result.json();
    console.log("ticket",json.ticket)
    return json.ticket;
  }
  
  async function getAudit(ticket_id,subdomain,headers){
    const init = {
        method: 'GET',
        headers: headers
    }
    
    const result = await fetch('https://'+subdomain+'.zendesk.com/api/v2/tickets/'+ticket_id+'/audits', init)
    let json = await result.json();
    let audit = json.audits[0];
    if (audit.via.channel == "email"){
      var recipients = audit.via.source.from.original_recipients
      console.log("recipients",recipients)
      return recipients
    } else {
      return []
    }
  }
  
  async function createTicket(ticket,recipient,ticket_id,subdomain,headers){
    var payload = {
      "ticket": {
        "subject": ticket.subject,
        "comment": {
          "html_body": `Split from ticket #${ticket_id}<br>${ticket.description}`,
        },
        "recipient": recipient,
        "requester_id": ticket.requester_id,
        "via": {
          "channel": "mail",
        }
      }
  }
  
    const init = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    }
    const result = await fetch('https://'+subdomain+'.zendesk.com/api/v2/tickets.json', init)
    var json = await result.json()
    return json.audit.ticket_id
  }