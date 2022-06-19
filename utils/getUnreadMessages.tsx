import { HomeScreenParseInboxPayload } from "../utils/parseInboxPayload";
import { getDatabase, ref, get, child} from "firebase/database";

export const GetUnreadMessages = (address : string | undefined, setUserMessages : any) => {
    const dbRef = ref(getDatabase());
    get(child(dbRef, 'messages/' + address + '/unread')).then((snapshot) => {
        if (snapshot.exists()) {
          let data = snapshot.val();
          HomeScreenParseInboxPayload(data, setUserMessages, address);
        } else {
          //@ts-ignore
          setUserMessages([{from: "", message: "", time: null}]);
        }
      }).catch((error) => {
        console.error(error);
      });
  }
