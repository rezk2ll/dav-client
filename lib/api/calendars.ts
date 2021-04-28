import { xml2js } from 'xml-js';
import { MultiStatusResponse } from '../../types/XMLResponses';
import { DAVClient } from '../DAVClient';
import { CalendarEventObject, parse, translate } from 'dav-parser';
import urlJoin from 'url-join';

const BASE_PATH = '/calendars';

export interface CalendarData {
  href: string;
  etag: string;
  ics: string;
  events: CalendarEventObject[];
}
export interface ChangeParticipationOptions {
  eventPath: string;
  attendeeEmail: string;
  action: string;
  event: CalendarEventObject;
}

export const getInbox = (client: DAVClient) => async (userId: string): Promise<CalendarData[]> => {
  const responseText: string = await client.requestText({
    url: urlJoin(BASE_PATH, userId, 'inbox'),
    method: 'REPORT',
    headers: {
      Depth: '1',
    },
    body: `<c:calendar-query
            xmlns:d="DAV:"
            xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:prop>
              <d:getetag />
              <c:calendar-data />
            </d:prop>
            <c:filter>
              <c:comp-filter name="VCALENDAR" />
            </c:filter>
          </c:calendar-query>`,
  });

  const response = xml2js(responseText, { compact: true }) as MultiStatusResponse;

  return response['d:multistatus']['d:response'].map((responseItem) => ({
    href: responseItem['d:href']._text,
    etag: responseItem['d:propstat']['d:prop']['d:getetag']._text,
    ics: responseItem['d:propstat']['d:prop']['cal:calendar-data']._text,
    events: parse(responseItem['d:propstat']['d:prop']['cal:calendar-data']._text),
  }));
};

export const modifyEvent = (client: DAVClient) => async (eventPath: string, event: CalendarEventObject): Promise<string> => {
  return await client.requestText({
    url: urlJoin(BASE_PATH, eventPath),
    method: 'PUT',
    body: translate(event),
  });
};

export const changeParticipation = (client: DAVClient) => async ({ eventPath, attendeeEmail, action, event }: ChangeParticipationOptions): Promise<string> => {
  if (!Array.isArray(event.attendees)) return Promise.reject('Can not change participation');

  for (const attendee of event.attendees) {
    if (attendee.email !== attendeeEmail) continue;

    attendee.partstat = action;

    return modifyEvent(client)(eventPath, event);
  }

  return Promise.reject('No matching attendee found in the event');
};

export const deleteEvent = (client: DAVClient) => async (eventPath: string): Promise<string> => {
  return await client.requestJson({
    url: urlJoin(BASE_PATH, eventPath),
    method: 'DELETE',
  });
};
