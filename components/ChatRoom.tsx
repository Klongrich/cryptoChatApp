import React, {useState, useEffect} from 'react';

import { ref, onValue } from "firebase/database";
import { GetAllChatMessages } from "../utils/chatbox/GetAllChatMessages";

import { SendPlane } from "@styled-icons/remix-fill/SendPlane";
import { SendMessage } from "../utils/sendMessage";

import { ChatRoomBox,
        ChatRoomContainer,
        ChatRoomContainerDesktop,
        FromBox,
        ToBox,
        InputMessageMobile,
        InputMessageDesktop,
        InputBoxContainerMobile,
        InputBoxContainerDesktop,
        SendPlaneContainerDesktop,
        SendPlaneContainerMobile } from "../styles/ChatRoom";

export const ChatRoom = ({fromAddress, toAddress, toAlias, database, windowHeight} : any ) => {

    const [chatMessages, setChatMessages] = useState([{from: "", message: "", time: ""}]);
    const [message, setMessage] = useState("");

    const [isMobile, setIsMobile] = useState(false);
    const [chatHeight, setChatHeight] = useState("490px");

    function cutUserAddress(address : string) {
        if (address.includes("0x")) {
            return (address.substring(0, 5) + "...." + address.substring(address.length - 5, address.length));
        } else if (address) {
            return (address);
        } else {
            return (null);
        }
    }

    useEffect(() => {
        async function ListenForFrom() {
             console.log("---Listen For----")
              const listining = ref(database, 'messages/' + fromAddress.toLowerCase() + '/unread/' + toAddress.toLowerCase());
              onValue(listining, (snapshot) => {
                getMessages();
            });
          }
          ListenForFrom();
    }, [])

    useEffect(() => {
        async function ListenForTo() {
            console.log("---Listeing To---")
            const listining = ref(database, 'messages/' + toAddress.toLowerCase() + '/unread/' + fromAddress.toLowerCase());
            onValue(listining, (snapshot) => {
                getMessages();
            });
        }
        ListenForTo();
    }, [])

    async function getMessages() {
        console.log("Hello World");
        let AllMessages = await GetAllChatMessages(toAddress, fromAddress);
        //@ts-ignore
        setChatMessages(AllMessages);
    }

    function checkKey(key : any) {
        if (key === "Enter") {
            SendMessage(fromAddress, toAddress, message, null, null, setMessage);
            setMessage("");
        }
    }

    async function setChatRoomHeight() {
        if(windowHeight) {
            let _height = parseInt(windowHeight.substring(0,3));
            let ChatHeight = _height - 169;
            let StringToPass = ChatHeight + "px";

            console.log("windowHeight: " + StringToPass);
            setChatHeight(StringToPass);
        }
    }

    useEffect(() => {
        setChatRoomHeight();
        getMessages();
        if (window.innerWidth < 999) {
            setIsMobile(true);
        } else {
            setIsMobile(false);
        }
    }, [chatHeight])

    return (
        <>
            <ChatRoomBox>
                {toAlias && <>
                    <h4>{toAlias}</h4>
                </>}
                {!toAlias && <>
                <h4> {cutUserAddress(toAddress)} </h4>
                </>}
            </ChatRoomBox>

            {!isMobile && <>
            <ChatRoomContainerDesktop>
                {chatMessages.map((data) =>
                    <>
                        {data.time != null && data.from != '' && <>
                            {data.from.toLowerCase() != fromAddress.toLowerCase() && <>
                                <FromBox>
                                    <p> {data.message} </p>
                                </FromBox>
                            </>}
                            {data.from.toLowerCase() != toAddress.toLowerCase() && <>
                                <ToBox>
                                    <p> {data.message} </p>
                                </ToBox>
                            </>}
                        </>}
                    </>
                )}
            </ChatRoomContainerDesktop>

            <InputBoxContainerDesktop>
                <InputMessageDesktop placeholder={"Enter Message"}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => checkKey(e.key)}
                      />
                <br /> <br /> <br />

                <SendPlaneContainerDesktop>
                    <SendPlane size={42} color="white" onClick={() => SendMessage(
                        fromAddress,
                        toAddress,
                        message,
                        null,
                        null,
                        setMessage
                    )} />
                </SendPlaneContainerDesktop>
            </InputBoxContainerDesktop>
            </>}

            {isMobile && <>
                <ChatRoomContainer color={chatHeight}>
                {chatMessages.map((data) =>
                    <>
                        {data.time != null && <>
                            {data.from.toLowerCase() != fromAddress.toLowerCase() && <>
                                <FromBox>
                                    <p> {data.message} </p>
                                </FromBox>
                            </>}
                            {data.from.toLowerCase() != toAddress.toLowerCase() && <>
                                <ToBox>
                                    <p> {data.message} </p>
                                </ToBox>
                            </>}
                        </>}
                    </>
                )}
            </ChatRoomContainer>

            <InputBoxContainerMobile>
                <InputMessageMobile placeholder={"Enter Message"}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                      />
                <br /> <br /> <br />

                <SendPlaneContainerMobile>
                    <SendPlane size={30} color="white" onClick={() => SendMessage(
                        fromAddress,
                        toAddress,
                        message,
                        null,
                        null,
                        setMessage
                    )} />
                </SendPlaneContainerMobile>
            </InputBoxContainerMobile>

            </>}

        </>
    )
}