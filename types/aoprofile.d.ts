declare module '@permaweb/aoprofile' {
  interface ProfileData {
    userName: string;
    displayName: string;
    description: string;
    thumbnail?: string;
    banner?: string;
  }

  interface ProfileResponse {
    id: string;
    userName: string;
    displayName: string;
    description: string;
    thumbnail?: string;
    banner?: string;
    [key: string]: any;
  }

  interface AOProfileSDK {
    createProfile: (data: ProfileData) => Promise<string>;
    updateProfile: (data: { profileId: string } & ProfileData) => Promise<string>;
    getProfileById: (params: { profileId: string }) => Promise<ProfileResponse>;
    getProfileByWalletAddress: (params: { address: string }) => Promise<ProfileResponse>;
    getRegistryProfiles: (params: { profileIds: string[] }) => Promise<ProfileResponse[]>;
  }

  function init(params: { 
    ao: any; 
    signer?: any; 
    arweave?: any;
    logging?: boolean;
  }): AOProfileSDK;

  const AOProfile: {
    init: typeof init;
  };

  export default AOProfile;
}
