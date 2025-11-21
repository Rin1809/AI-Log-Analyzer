import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Box,
    Button,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    MenuDivider,
    InputGroup,
    Input,
    InputLeftElement,
    InputRightElement,
    Icon,
    Text,
    Tag,
    TagLabel,
    TagCloseButton,
    IconButton,
    useDisclosure,
    useColorModeValue,
    Portal 
} from '@chakra-ui/react';
import { ChevronDownIcon, LockIcon, UnlockIcon, CheckIcon, SettingsIcon } from '@chakra-ui/icons';
import ApiKeyManagerModal from './ApiKeyManagerModal';

const ApiKeySelector = ({ value, onChange, isTestMode }) => {
    const [profiles, setProfiles] = useState({});
    const [loading, setLoading] = useState(false);
    const [showKey, setShowKey] = useState(false);
    

    const { isOpen, onOpen, onClose } = useDisclosure();

    const bg = useColorModeValue('white', 'gray.700');
    const iconColor = useColorModeValue('gray.400', 'gray.500');
    
    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/system-settings', { params: { test_mode: isTestMode } });
            setProfiles(res.data.gemini_profiles || {});
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [isTestMode]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]); 

    const handleProfileSelect = (profileName) => {
        onChange(`profile:${profileName}`);
    };

    const handleClearProfile = () => {
        onChange('');
    };

    const isProfile = value && value.startsWith('profile:');
    const currentProfileName = isProfile ? value.split(':', 2)[1] : null;
    const isProfileValid = isProfile && profiles.hasOwnProperty(currentProfileName);

    return (
        <Box position="relative">
            <InputGroup size="md">
                <InputLeftElement pointerEvents="none">
                    <Icon as={LockIcon} color={isProfile ? "black.500" : iconColor} />
                </InputLeftElement>
                
                {isProfile ? (
                    <Box 
                        flex="1" 
                        pl={10} 
                        pr={2} 
                        py={2} 
                        borderWidth="1px" 
                        borderColor={isProfileValid ? "inherit" : "red.300"} 
                        borderRadius="md" 
                        bg={bg} 
                        display="flex"
                        alignItems="center"
                        h="40px"
                    >
                        <Tag 
                            size="md" 
                            borderRadius="full" 
                            variant="subtle" 
                            colorScheme="gray"
                        >
                            <TagLabel fontWeight="medium">{currentProfileName}</TagLabel>
                            <TagCloseButton onClick={handleClearProfile} />
                        </Tag>
                        {!isProfileValid && (
                             <Text fontSize="xs" color="red.500" ml={2} fontWeight="medium">(Not found)</Text>
                        )}
                    </Box>
                ) : (
                    <Input
                        type={showKey ? 'text' : 'password'}
                        placeholder="Enter Raw API Key or Select Profile..."
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        bg={bg}
                        pr="8rem" 
                        fontFamily="monospace"
                    />
                )}

                <InputRightElement width="6.5rem">
                    {!isProfile && (
                        <IconButton
                            h="1.75rem"
                            size="sm"
                            onClick={() => setShowKey(!showKey)}
                            icon={showKey ? <UnlockIcon /> : <LockIcon />}
                            variant="ghost"
                            colorScheme="gray"
                            mr={1}
                            aria-label="Toggle show key"
                        />
                    )}
                    
                    <Menu placement="bottom-end">
                        <MenuButton 
                            as={Button} 
                            h="1.75rem" 
                            size="sm" 
                            rightIcon={<ChevronDownIcon />} 
                            colorScheme={isProfile ? "black" : "gray"}
                            variant={isProfile ? "ghost" : "ghost"}
                            isLoading={loading}
                            fontSize="xs"
                            fontWeight="normal"
                            color="gray.500"
                        >
                            Profile
                        </MenuButton>
                        <Portal>
                            <MenuList zIndex={2500}>
                                <MenuItem onClick={handleClearProfile} icon={<Icon as={LockIcon}/>}>
                                    Use Raw Key
                                </MenuItem>
                                <MenuDivider />
                                {Object.keys(profiles).length === 0 ? (
                                    <MenuItem isDisabled fontSize="sm" color="gray.500">No profiles found</MenuItem>
                                ) : (
                                    Object.keys(profiles).map(name => (
                                        <MenuItem key={name} onClick={() => handleProfileSelect(name)} icon={name === currentProfileName ? <CheckIcon color="green.500"/> : null}>
                                            {name}
                                        </MenuItem>
                                    ))
                                )}
                                <MenuDivider />
                                <MenuItem icon={<SettingsIcon />} onClick={onOpen} color="black.500" fontWeight="medium">
                                    Manage Profiles...
                                </MenuItem>
                            </MenuList>
                        </Portal>
                    </Menu>
                </InputRightElement>
            </InputGroup>

            <ApiKeyManagerModal 
                isOpen={isOpen} 
                onClose={onClose} 
                isTestMode={isTestMode}
                onProfilesChange={(newProfiles) => setProfiles(newProfiles)}
            />
        </Box>
    );
};

export default ApiKeySelector;