import type { NextPage } from 'next'
import styled from 'styled-components';

import Head from 'next/head'
import Web3 from "web3";

import styles from  "../styles/Home.module.css";

import {useEffect, useState, useCallback, useReducer} from "react";

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from "firebase/auth";
import { addDoc, collection, getFirestore, doc, setDoc, getDoc, updateDoc } from "firebase/firestore/lite";

import { ref, onValue, getDatabase, get, child } from "firebase/database";

import Web3Modal from 'web3modal';
import WalletConnectProvider from '@walletconnect/web3-provider';
import { providers } from 'ethers';

import { Inbox } from "../components/Inbox";
import { ContactBox } from "../components/ContactBox";
import { NewContact } from "../components/NewContact";

import { NewMessageScreen } from "../components/NewMessage";
import { ChatRoom } from "../components/ChatRoom";
import { ArrowBack } from "@styled-icons/boxicons-regular/ArrowBack";
import { Message } from "@styled-icons/boxicons-regular/Message";

import { Add } from "@styled-icons/fluentui-system-filled/Add";
import { ThreeDotsVertical } from "@styled-icons/bootstrap/ThreeDotsVertical";

import { slide as Menu } from 'react-burger-menu'
import { deleteField } from '@firebase/firestore';
import { ChatRoomContainerDesktop } from '../styles/ChatRoom';

import { getUserInboxMessages}  from "../utils/inbox/getUserInboxMessages";
import { burgerStyles } from "../static/burgerMenuStyles";
import { FirebaseConfig } from "../static/firbaseConfig";

import { SiweMessage } from 'siwe';

import { HeaderBox,
        NewMessageBox,
        LogOutArrow,
        NewMessageArrowBox,
        BackArrowBox,
        AddContactBox,
        NewContactBackArrowBox,
        AddContactButton,
        EditMessageBox,
        ContainerBox,
        SolWelcomeBox
} from "../styles/pages";

import { MetaBox } from "../components/MetaBox";

import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";


//Used to get all ERC20 or E721 Token Meta of any address

//Uses Etherscans API calls to return all ERC20 or ERC721 Token Transfer Events
//Then connects to a Infura-Node to create a web3js instance to pull external meta.
import { GetUserTokenMeta } from "../utils/eth/getUserTokenMeta";

//Test
import { ExampleTest } from "../test/getUserTokenMetaExampleTest";
import { sign } from 'crypto';

// Initialize Firebase
const app = initializeApp(FirebaseConfig);
const db = getFirestore(app);
const auth = getAuth();
signInAnonymously(auth);
const database = getDatabase();

type PhantomEvent = "disconnect" | "connect" | "accountChanged";

interface ConnectOpts {
    onlyIfTrusted: boolean;
}
interface PhantomProvider {
    connect: (opts?: Partial<ConnectOpts>) => Promise<{ publicKey: PublicKey }>;
    disconnect: ()=>Promise<void>;
    on: (event: PhantomEvent, callback: (args:any)=>void) => void;
    isPhantom: boolean;
}

type WindowWithSolana = Window & {
    solana?: PhantomProvider;
}

// Initalize web3 provider options
const providerOptions = {
  walletconnect: {
      package: WalletConnectProvider,
      options: {
          infuraId: process.env.INFURA_ID
      },
  },
  binancechainwallet: {
    package: true
  },
  opera: {
    package: true
  }
};

let web3Modal : any
if (typeof window !== 'undefined') {
  web3Modal = new Web3Modal({
    cacheProvider: true,
    providerOptions, // required
  })
}

type StateType = {
  provider?: any
  web3Provider?: any
  address?: string
  chainId?: number
}

type ActionType =
  | {
      type: 'SET_WEB3_PROVIDER'
      provider?: StateType['provider']
      web3Provider?: StateType['web3Provider']
      address?: StateType['address']
      chainId?: StateType['chainId']
    }
  | {
      type: 'SET_ADDRESS'
      address?: StateType['address']
    }
  | {
      type: 'SET_CHAIN_ID'
      chainId?: StateType['chainId']
    }
  | {
      type: 'RESET_WEB3_PROVIDER'
    }

const initialState: StateType = {
  provider: null,
  web3Provider: null,
  address: "",
  chainId: 0x4,
}

function reducer(state: StateType, action: ActionType): StateType {
  switch (action.type) {
    case 'SET_WEB3_PROVIDER':
      return {
        ...state,
        provider: action.provider,
        web3Provider: action.web3Provider,
        address: action.address,
        chainId: action.chainId,
      }
    case 'SET_ADDRESS':
      return {
        ...state,
        address: action.address,
      }
    case 'SET_CHAIN_ID':
      return {
        ...state,
        chainId: action.chainId,
      }
    case 'RESET_WEB3_PROVIDER':
      return initialState
    default:
      throw new Error()
  }
}



const Home: NextPage = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [state, dispatch] = useReducer(reducer, initialState)
  const { provider, web3Provider, address, chainId } = state

  const [cutUserAddress, setCutUserAddress] = useState("");
  const [newMessage, setNewMessage] = useState(false);
  const [chatRoom, setChatRoom] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [newContact, setNewContact] = useState(false);

  const [editMessages, setEditMessages] = useState(false);

  const [chatToAddress, setChatToAddress] = useState("");
  const [chatFromAddress, setChatFromAddress] = useState("");

  const [toAlias, setToAlias] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  const [displayUserMeta, setDisplayUserMeta] = useState(false);

  const [ solProvider, setSolProvider ] = useState<PhantomProvider | null>(null);
  const [ pubKey, setPubKey ] = useState<string | null>(null);
  const [isSolana, setIsSolana] = useState(false);

  const [userInboxMessages, setUserInboxMessages] = useState([{from : "", message : "", time : 0, alias : ""}])

  const [windowHeight, setWindowHeight] = useState("1000px");

  const [userERC721, setUserERC721] = useState([{
    tokenName : "",
    tokenId : 0,
    contractAddress : "",
    tokenSymbol : "",
    tokenURI : "",
    image : "",
  }])

  const [userERC20, setUserERC20] = useState([{
    tokenName : "",
    amount : 0
  }])

  const [ERC20IsLoaded, setERC20IsLoaded] = useState(false);
  const [ERC721IsLoaded, setERC721IsLoaded] = useState(false);

  async function getInboxMessages(address : string) {
    //@ts-ignore
    let _userMessages = await getUserInboxMessages(address, db);
    //@ts-ignore
    setUserInboxMessages(_userMessages);
  }

  async function listenForInbox(address : string) {
    const listining = ref(database, 'messages/' + address.toLowerCase() + '/Inbox');
    //This function should be listening for an update to firebase instead of realtime database however
    //firebase update listening in nextjs and typescirpt dosen't work right now for me

    //So this is the next best thing. its not optmial though as I have to have one database call
    //make another database call rather than just having a singluar database connected to trigger
    //the call. Kind of sucks but it is what it is.
    const currentTime = await new Date().getTime();
    setCurrentTime(currentTime);
    await onValue(listining, (snapshot) => {
        if (address) {
          getInboxMessages(address);
        }
  });
}

  async function SignInWithETH(web3Provider : any, statement: any) {
    if (window.location) {
      const signer = await web3Provider.getSigner();
      const domain = window.location.host;
      const origin = window.location.origin;

      let address = await signer.getAddress();

      const message = new SiweMessage({
        domain,
        address,
        statement,
        uri: origin,
        version: '1',
        chainId: 1
      })

      let Message = await message.prepareMessage();

      if (message) {
        let signature = await signer.signMessage(Message);
        let CheckMessage = await new SiweMessage(message);

        try {
          let res = await CheckMessage.validate(signature);
          if (res) {
            return (true);
          }
        } catch (error) {
          return (false);
        }
      }
    }
  }


  const connect = useCallback(async function () {
    // This is the initial `provider` that is returned when
    // using web3Modal to connect. Can be MetaMask or WalletConnect.
    const provider = await web3Modal.connect();

    // We plug the initial `provider` into ethers.js and get back
    // a Web3Provider. This will add on methods from ethers.js and
    // event listeners such as `.on()` will be different.
    const web3Provider = new providers.Web3Provider(provider)
    const signer = web3Provider.getSigner()

    let isSignedIn = await SignInWithETH(web3Provider, "Hello World");

    if (isSignedIn) {
      setLoggedIn(true);
    } else {
      setLoggedIn(false);
    }

    const address = await (await signer.getAddress()).toLowerCase();

    //Call To check User Firestore here instead.
    await listenForInbox(address);

    const cutUserAddress = await address.substring(0, 5) + "...." + address.substring(address.length - 5, address.length)
    setCutUserAddress(cutUserAddress);

    const network = await web3Provider.getNetwork();

    dispatch({
      type: 'SET_WEB3_PROVIDER',
      provider,
      web3Provider,
      address,
      chainId: network.chainId,
    })
  }, [])

  const disconnect = useCallback(
    async function () {
      await web3Modal.clearCachedProvider()
      setLoggedIn(false);
      if (provider?.disconnect && typeof provider.disconnect === 'function') {
        await provider.disconnect()
      }
      dispatch({
        type: 'RESET_WEB3_PROVIDER',
      })
    },
    [provider, loggedIn]
  )

  // Auto connect to the cached provider
  useEffect(() => {
    if (web3Modal.cachedProvider) {
      connect()
    }
  }, [connect])

  // A `provider` should come with EIP-1193 events. We'll listen for those events
  // here so that when a user switches accounts or networks, we can update the
  // local React state with that new information.
  useEffect(() => {
    if (provider?.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('accountsChanged', accounts)
        dispatch({
          type: 'SET_ADDRESS',
          address: accounts[0],
        })
      }

      const handleChainChanged = (_hexChainId: string) => {
        window.location.reload()
      }

      const handleDisconnect = (error: { code: number; message: string }) => {
        console.log('disconnect', error)
        disconnect()
      }

      provider.on('accountsChanged', handleAccountsChanged)
      provider.on('chainChanged', handleChainChanged)
      provider.on('disconnect', handleDisconnect)

      // Subscription Cleanup
      return () => {
        if (provider.removeListener) {
          provider.removeListener('accountsChanged', handleAccountsChanged)
          provider.removeListener('chainChanged', handleChainChanged)
          provider.removeListener('disconnect', handleDisconnect)
        }
      }
    }
  }, [provider, disconnect])

  //Have a create user function than be able to append and add contracts to firestore.
  async function saveContact() {
    const db = getFirestore();

    const docRef = await addDoc(collection(db, "UserName"), {
      address: "TestInputDatas"
    });
    console.log("Document written with ID: ", docRef.id);
  }

  function updateToChatRoom(toAddress: string, fromAddress: string, toAlias: string, hotFixx : boolean) {
    setChatRoom(true);
    setChatToAddress(toAddress);
    setChatFromAddress(fromAddress);
    setToAlias(toAlias);

    //console.log(address);
    if (hotFixx) {
      if (address) {
        getInboxMessages(address);
      }
    }
  }

  async function deleteContact(addressToDelete : string) {
    //@ts-ignore
    const docRef = doc(db, address, "Inbox");
    const docSnap = await getDoc(docRef);

    let _data = docSnap.data();

    if (_data) {
      for (let e = 0; e < 10; e++) {
        if (_data[e] == addressToDelete) {
          _data[e] = "Free"
        }
      }
      await setDoc(docRef, _data);
      setNewContact(false);
      setEditMessages(false);
      setChatRoom(false);
    }
  }

  useEffect(() => {
    if (address) {
      getInboxMessages(address);
    }
  }, [])

  async function getMetaData(){
    setNewContact(false);
    setChatRoom(false);
    setNewMessage(false);

    setDisplayUserMeta(true);
  }

  async function updatePageState(view : string) {
    if (view == "All") {
      setShowContacts(false);
      setDisplayUserMeta(false);
      return ;
    }

    if (view == "Contacts") {
      setShowContacts(true);
      setDisplayUserMeta(false);
      return ;
    }

    if (view == "Meta") {
      console.log("Hello");
      setDisplayUserMeta(true);
      setShowContacts(false);
      return ;
    }
  }

  useEffect( ()=>{
    if ("solana" in window) {
      const solWindow = window as WindowWithSolana;
      if (solWindow?.solana?.isPhantom) {
          setSolProvider(solWindow.solana);
          solWindow.solana.connect({ onlyIfTrusted: true });
      }
    }
  }, []);

  async function updateToSolUser() {
    solProvider?.on("connect", (pubKey: PublicKey) => {
      let publicKey = pubKey?.toBase58();

      if (publicKey != null) {
        setPubKey(publicKey)

        if (publicKey) {
          listenForInbox(publicKey);
        }

        setIsSolana(true);
        setLoggedIn(true);
      }
    });

    await solProvider?.connect()
    .catch((err : any) => { console.error("connect ERROR:", err); });
  }

  async function disConnectSolUser() {
    solProvider?.on("disconnect", () => {
      setPubKey(null);
      setLoggedIn(false);
      setIsSolana(false);
    });

    solProvider?.disconnect()
    .catch((err : any) => {console.error("disconnect ERROR:", err); });
  }

  useEffect(() => {
    let wh = window.innerHeight + "px";
    setWindowHeight(wh);
  }, [windowHeight])

  return (<>

  <ContainerBox color={windowHeight}>
      <Head>
        <title>Crypto Chat</title>
        <meta name="description" content="Next Generation Chat App!" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {!loggedIn && <>
        <div className={styles.timeWaste}>
          <h2> Welcom to Crypto Chat! </h2>
          <h3> Connect your web3 wallet to sign in </h3>
          <button type="button" onClick={() => connect()}>
            Connect with Etheruem
          </button>

          <br /> <br />

          <button onClick={() => updateToSolUser()}>
            Connect with Solana
          </button>

          <h4> Logged Out </h4>
        </div>
      </>}

      {loggedIn && <>
        {newMessage && <>
          <NewMessageArrowBox>
            <ArrowBack size={28} color="white" onClick={() => setNewMessage(false)} />
          </NewMessageArrowBox>

          {address && <>
            <NewMessageScreen userAddress={address}
                              updateToChatRoom={updateToChatRoom}
                              setNewMessage={setNewMessage}
                              db={db}
                              />
          </>}
        </>}

        {!newMessage && <>
          {!chatRoom && <>
            <HeaderBox>
              <LogOutArrow>
                {isSolana && <>
                  <ArrowBack size={30} color="white" onClick={() => disConnectSolUser()} />
                </>}

                {!isSolana && <>
                  <ArrowBack size={30} color="white" onClick={() => disconnect()} />
                </>}
              </LogOutArrow>
              <h2>Messages</h2>
              <ul>
                <li onClick={() => updatePageState("All")}>All</li>
                <li onClick={() => updatePageState("Contacts")}>Contacts</li>
                <li onClick={() => updatePageState("Meta")}> Meta </li>
                <li onClick={() => setNewMessage(true)}>+</li>
              </ul>

              {isSolana && <>
                <SolWelcomeBox>
                  <h4> Account ID </h4>
                  {/* <h5> {pubKey?.substring(0,5) + "....." + pubKey?.substring(pubKey.length, pubKey.length - 5)} </h5> */}

                  <h5>{pubKey} </h5> <br />
                  <p> CryptoChat is currently intergrating decentralized messaging within the SOL network. </p>
                  <p> Check back for more updates! </p>
                </SolWelcomeBox>
              </>}
            </HeaderBox>

            {!showContacts && !displayUserMeta && <>
              <Inbox userAddress={address}
                    database={database}
                    updateToChatRoom={updateToChatRoom}
                    db={db}
                    userInboxMessages={userInboxMessages}
              />
              <NewMessageBox>
                <Message size={40} color="white" onClick={() => setNewMessage(true)} />
              </NewMessageBox>
            </>}

            {showContacts && !displayUserMeta && <>
              <ContactBox userAddress={address} db={db} updateToChatRoom={updateToChatRoom} contactList={userInboxMessages} />

                <AddContactButton onClick={() => setNewContact(true)}>
                  <Add size={35} color="white" />
                </AddContactButton>
            </>}

            {displayUserMeta && !showContacts && <>
              <MetaBox userERC721={userERC721}
                       userERC20={userERC20}
                       ERC20IsLoaded={ERC20IsLoaded}
                       ERC721IsLoaded={ERC721IsLoaded}
                       userAddress={address}
                       />
            </>}
          </>}

          {chatRoom && !displayUserMeta && <>
            {!newContact && <>
              <BackArrowBox>
                <ArrowBack size={28} color="white" onClick={() => setChatRoom(false)} />
              </BackArrowBox>

              <AddContactBox>
                <Add size={28} color="white" onClick={() => setNewContact(true)}  />
              </AddContactBox>

              <ChatRoom toAddress={chatToAddress}
                      fromAddress={chatFromAddress}
                      database={database}
                      db={db}
                      toAlias={toAlias}
                      windowHeight={windowHeight} />
            </>}

            {/* Update To Chat Room */}
            {newContact && <>
              <BackArrowBox>
                <ArrowBack size={28} color="white" onClick={() => setNewContact(false)} />
              </BackArrowBox>

              <AddContactBox>
                <ThreeDotsVertical size={28} color="white" onClick={() => setEditMessages(!editMessages)} />
              </AddContactBox>

              {editMessages && <>
              <EditMessageBox>
                <Menu right styles={burgerStyles} width={'70%'} isOpen={editMessages} onClose={() => setEditMessages(false)}>
                  <p onClick={() => deleteContact(chatToAddress)}>Delete Contact</p>
                  <p>Edit Contact</p>
                </Menu>
              </EditMessageBox>
              </>}

              <NewContact userAddress={address}
                          contactPublicKey={chatToAddress}
                          db={db}
                          setNewContact={setNewContact}
                          updateToChatRoom={updateToChatRoom}
                          setEditMessages={setEditMessages}
              />
            </>}
          </>}
        </>}
      </>}
      </ContainerBox> </>)
}

export default Home
