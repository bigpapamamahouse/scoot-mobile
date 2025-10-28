
import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { NotificationsAPI } from '../api';
import { Notification } from '../types';

export default function NotificationsScreen(){
  const [items, setItems] = React.useState<Notification[]>([]);
  React.useEffect(()=>{
    NotificationsAPI.listNotifications(true).then(r=> setItems(r.items || [])).catch(e=> console.warn(e));
  }, []);
  return (
    <FlatList
      style={{ padding: 12 }}
      data={items}
      keyExtractor={(it)=>it.id}
      renderItem={({ item }) => (
        <View style={{ padding: 12, backgroundColor: 'white', borderRadius: 12, marginBottom: 8 }}>
          <Text style={{ fontWeight: '600' }}>@{item.fromHandle || item.fromUserId.slice(0,8)}</Text>
          <Text>{item.message || 'Notification'}</Text>
          <Text style={{ color: '#888', fontSize: 12 }}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#666', marginTop: 40 }}>No notifications</Text>}
    />
  );
}
